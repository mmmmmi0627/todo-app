"use client";

import { useEffect, useRef, useState } from "react";

type Filter = "all" | "active" | "completed";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [hydrated, setHydrated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("todos");
    if (stored) setTodos(JSON.parse(stored));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem("todos", JSON.stringify(todos));
  }, [todos, hydrated]);

  const addTodo = () => {
    const text = input.trim();
    if (!text) return;
    setTodos((prev) => [
      { id: crypto.randomUUID(), text, completed: false, createdAt: Date.now() },
      ...prev,
    ]);
    setInput("");
    inputRef.current?.focus();
  };

  const toggleTodo = (id: string) =>
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );

  const deleteTodo = (id: string) =>
    setTodos((prev) => prev.filter((t) => t.id !== id));

  const clearCompleted = () =>
    setTodos((prev) => prev.filter((t) => !t.completed));

  const filtered = todos.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.filter((t) => t.completed).length;

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "すべて" },
    { key: "active", label: "未完了" },
    { key: "completed", label: "完了済み" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-start justify-center px-4 pt-16 pb-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <h1 className="text-4xl font-bold text-center text-indigo-600 dark:text-indigo-400 mb-8 tracking-tight">
          ToDo リスト
        </h1>

        {/* Input */}
        <div className="flex gap-2 mb-6">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTodo()}
            placeholder="タスクを入力して Enter または追加"
            className="flex-1 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
          />
          <button
            onClick={addTodo}
            className="rounded-xl bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white px-5 py-3 font-semibold shadow-sm transition"
          >
            追加
          </button>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden">
          {/* Filter tabs */}
          <div className="flex border-b border-gray-100 dark:border-gray-700">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex-1 py-3 text-sm font-medium transition ${
                  filter === key
                    ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* List */}
          {!hydrated ? null : filtered.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-gray-500 py-12 text-sm">
              {filter === "completed" ? "完了済みのタスクはありません" : "タスクがありません"}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map((todo) => (
                <li
                  key={todo.id}
                  className="flex items-center gap-3 px-5 py-4 group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                >
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    aria-label={todo.completed ? "未完了に戻す" : "完了にする"}
                    className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition ${
                      todo.completed
                        ? "bg-indigo-500 border-indigo-500"
                        : "border-gray-300 dark:border-gray-500 hover:border-indigo-400"
                    }`}
                  >
                    {todo.completed && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>

                  <span
                    className={`flex-1 text-sm leading-relaxed transition ${
                      todo.completed
                        ? "line-through text-gray-400 dark:text-gray-500"
                        : "text-gray-800 dark:text-gray-100"
                    }`}
                  >
                    {todo.text}
                  </span>

                  <button
                    onClick={() => deleteTodo(todo.id)}
                    aria-label="削除"
                    className="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition ml-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3 4h10M6 4V3h4v1M5 4l.5 8h5L11 4"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Footer */}
          {hydrated && todos.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
              <span>{activeCount} 件残り</span>
              {completedCount > 0 && (
                <button
                  onClick={clearCompleted}
                  className="hover:text-red-400 transition"
                >
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
