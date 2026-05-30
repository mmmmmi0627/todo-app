"use client";

import { useEffect, useRef, useState } from "react";

type StatusFilter = "all" | "active" | "completed";
type Priority = "high" | "medium" | "low";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  dueDate: string;
  category: string;
  priority: Priority;
  notifyBefore: number; // 分単位
  notified: boolean;
}

const NOTIFY_OPTIONS = [
  { value: 0,     label: "期日ちょうど" },
  { value: 15,    label: "15分前" },
  { value: 30,    label: "30分前" },
  { value: 60,    label: "1時間前" },
  { value: 120,   label: "2時間前" },
  { value: 180,   label: "3時間前" },
  { value: 360,   label: "6時間前" },
  { value: 720,   label: "12時間前" },
  { value: 1440,  label: "1日前" },
  { value: 2880,  label: "2日前" },
  { value: 10080, label: "1週間前" },
];

const PRIORITY_LABEL: Record<Priority, string> = { high: "高", medium: "中", low: "低" };
const PRIORITY_COLOR: Record<Priority, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};
const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const DEFAULT_CATEGORIES = ["仕事", "プライベート", "買い物"];

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [hydrated, setHydrated] = useState(false);

  // Add form
  const [inputText, setInputText] = useState("");
  const [inputDueDate, setInputDueDate] = useState("");
  const [inputCategory, setInputCategory] = useState("");
  const [inputPriority, setInputPriority] = useState<Priority>("medium");
  const [inputNotifyBefore, setInputNotifyBefore] = useState(60);
  const [newCatInput, setNewCatInput] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [catFilter, setCatFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = localStorage.getItem("todos-v2");
    const c = localStorage.getItem("todo-categories");
    if (t) setTodos(JSON.parse(t));
    if (c) setCategories(JSON.parse(c));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem("todos-v2", JSON.stringify(todos));
  }, [todos, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem("todo-categories", JSON.stringify(categories));
  }, [categories, hydrated]);

  // Request browser notification permission
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Deadline check every 60 seconds
  useEffect(() => {
    if (!hydrated) return;
    const check = async () => {
      const now = Date.now();
      for (const todo of todos) {
        if (todo.completed || todo.notified || !todo.dueDate) continue;
        const due = new Date(todo.dueDate).getTime();
        const notifyAt = due - todo.notifyBefore * 60_000;
        if (now < notifyAt) continue;
        const isOverdue = due < now;
        const notifyLabel =
          NOTIFY_OPTIONS.find((o) => o.value === todo.notifyBefore)?.label ??
          `${todo.notifyBefore}分前`;
        const body = isOverdue
          ? `⚠️ 期限超過: ${todo.text}`
          : `⏰ ${notifyLabel}のお知らせ: ${todo.text}`;
        // Browser notification
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("ToDo リマインダー", { body });
        }
        // LINE notification
        await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: todo.text, dueDate: todo.dueDate, isOverdue, notifyLabel }),
        }).catch(() => {});
        setTodos((prev) => prev.map((t) => t.id === todo.id ? { ...t, notified: true } : t));
      }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [todos, hydrated]);

  const addTodo = () => {
    const text = inputText.trim();
    if (!text) return;
    setTodos((prev) => [
      {
        id: crypto.randomUUID(),
        text,
        completed: false,
        createdAt: Date.now(),
        dueDate: inputDueDate,
        category: inputCategory,
        priority: inputPriority,
        notifyBefore: inputNotifyBefore,
        notified: false,
      },
      ...prev,
    ]);
    setInputText("");
    setInputDueDate("");
    inputRef.current?.focus();
  };

  const addCategory = () => {
    const cat = newCatInput.trim();
    if (!cat || categories.includes(cat)) return;
    setCategories((prev) => [...prev, cat]);
    setNewCatInput("");
    setInputCategory(cat);
  };

  const toggleTodo = (id: string) =>
    setTodos((prev) => prev.map((t) => t.id === id ? { ...t, completed: !t.completed } : t));

  const deleteTodo = (id: string) =>
    setTodos((prev) => prev.filter((t) => t.id !== id));

  const clearCompleted = () =>
    setTodos((prev) => prev.filter((t) => !t.completed));

  const allCategories = Array.from(
    new Set([...categories, ...todos.map((t) => t.category).filter(Boolean)])
  );

  const filtered = todos
    .filter((t) => {
      if (statusFilter === "active" && t.completed) return false;
      if (statusFilter === "completed" && !t.completed) return false;
      if (catFilter && t.category !== catFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.text.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pd !== 0) return pd;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return b.createdAt - a.createdAt;
    });

  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.filter((t) => t.completed).length;

  const formatDue = (iso: string) => {
    const d = new Date(iso);
    const overdue = d < new Date();
    const label = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return { label, overdue };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-start justify-center px-4 pt-12 pb-16">
      <div className="w-full max-w-2xl">

        <h1 className="text-4xl font-bold text-center text-indigo-600 dark:text-indigo-400 mb-8 tracking-tight">
          ToDo リスト
        </h1>

        {/* ── Add form ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-5 mb-4">
          <div className="flex gap-2 mb-3">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTodo()}
              placeholder="タスクを入力..."
              className="flex-1 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
            />
            <button
              onClick={addTodo}
              className="rounded-xl bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white px-5 py-2.5 text-sm font-semibold shadow-sm transition"
            >
              追加
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">期日・時刻</label>
              <input
                type="datetime-local"
                value={inputDueDate}
                onChange={(e) => setInputDueDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">LINE 通知タイミング</label>
              <select
                value={inputNotifyBefore}
                onChange={(e) => setInputNotifyBefore(Number(e.target.value))}
                disabled={!inputDueDate}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition disabled:opacity-40"
              >
                {NOTIFY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">カテゴリ</label>
              <select
                value={inputCategory}
                onChange={(e) => setInputCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              >
                <option value="">なし</option>
                {allCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">重要度</label>
              <select
                value={inputPriority}
                onChange={(e) => setInputPriority(e.target.value as Priority)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
              placeholder="新しいカテゴリを追加..."
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
            />
            <button
              onClick={addCategory}
              className="rounded-lg border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
            >
              ＋ カテゴリ
            </button>
          </div>
        </div>

        {/* ── Search & filters ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-4 mb-4 space-y-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="タスク・カテゴリを検索..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {/* Status */}
            {(["all", "active", "completed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  statusFilter === s
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {s === "all" ? "すべて" : s === "active" ? "未完了" : "完了済み"}
              </button>
            ))}

            <span className="w-px bg-gray-200 dark:bg-gray-600 mx-0.5" />

            {/* Priority */}
            {(["all", "high", "medium", "low"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  priorityFilter === p
                    ? p === "high"
                      ? "bg-red-500 text-white"
                      : p === "medium"
                        ? "bg-yellow-500 text-white"
                        : p === "low"
                          ? "bg-green-500 text-white"
                          : "bg-gray-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {p === "all" ? "重要度: 全" : `重 ${PRIORITY_LABEL[p]}`}
              </button>
            ))}

            <span className="w-px bg-gray-200 dark:bg-gray-600 mx-0.5" />

            {/* Category */}
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCatFilter(catFilter === cat ? "" : cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  catFilter === cat
                    ? "bg-purple-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Todo list ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden">
          {!hydrated ? null : filtered.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-gray-500 py-12 text-sm">タスクがありません</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map((todo) => {
                const due = todo.dueDate ? formatDue(todo.dueDate) : null;
                return (
                  <li key={todo.id} className="flex items-start gap-3 px-5 py-4 group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      aria-label={todo.completed ? "未完了に戻す" : "完了にする"}
                      className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition ${
                        todo.completed
                          ? "bg-indigo-500 border-indigo-500"
                          : "border-gray-300 dark:border-gray-500 hover:border-indigo-400"
                      }`}
                    >
                      {todo.completed && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <span className={`block text-sm leading-relaxed ${
                        todo.completed ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-100"
                      }`}>
                        {todo.text}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLOR[todo.priority]}`}>
                          重要度: {PRIORITY_LABEL[todo.priority]}
                        </span>
                        {todo.category && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                            {todo.category}
                          </span>
                        )}
                        {due && (
                          <span className={`text-xs ${due.overdue && !todo.completed ? "text-red-500 font-semibold" : "text-gray-400 dark:text-gray-500"}`}>
                            {due.overdue && !todo.completed ? "⚠️ 期限超過 " : "🕐 "}{due.label}
                          </span>
                        )}
                        {todo.dueDate && !todo.notified && (
                          <span className="text-xs text-indigo-400 dark:text-indigo-500">
                            🔔 {NOTIFY_OPTIONS.find((o) => o.value === todo.notifyBefore)?.label ?? `${todo.notifyBefore}分前`}に通知
                          </span>
                        )}
                        {todo.notified && (
                          <span className="text-xs text-emerald-500">✓ LINE通知済み</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => deleteTodo(todo.id)}
                      aria-label="削除"
                      className="mt-0.5 text-gray-300 dark:text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                        <path d="M3 4h10M6 4V3h4v1M5 4l.5 8h5L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {hydrated && todos.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
              <span>{activeCount} 件残り</span>
              {completedCount > 0 && (
                <button onClick={clearCompleted} className="hover:text-red-400 transition">
                  完了済みを削除
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
