"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthForm() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = isLogin ? "/user/login" : "/user/register";
    const payload = isLogin
      ? { username, password }
      : { username, email, password };

    try {
      const res = await fetch(`http://backend:8000${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (isLogin && data.token) {
          localStorage.setItem("token", data.token);
          router.push("/home");
        }
        if (!isLogin) {
          setIsLogin(true);
          setError("");
        }
      } else {
        const errorData = await res.json();
        setError(errorData.detail || "Something went wrong.");
      }
    } catch {
      setError("An error occured, please try again");
    }
  };

  return (
    <div className="-mt-20">
      <div>
        <div className="justify-center flex flex-row mb-6">
          <a href="/" className="text-black font-1001 text-8xl">
            Paperion
          </a>
        </div>
      </div>

      <div>
        {" "}
        <form onSubmit={handleSubmit}>
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Username"
              className="text-md mb-3 w-80 border-1 p-2 px-4 border-gray-400 font-4005 tracking-wide rounded-md"
            />
          </div>

          {!isLogin && (
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email"
                className="text-md mb-3 w-80 border-1 p-2 px-4 border-gray-400 font-4005 tracking-wide rounded-md"
              />
            </div>
          )}

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
              className="text-md mb-3 w-80 border-1 p-2 px-4 border-gray-400 font-4005 tracking-wide rounded-md"
            />
          </div>
          <button
            className="text-md mb-3 w-80 bg-black text-white border-1 p-2 px-4 border-gray-400 font-4005 tracking-wide rounded-xl"
            type="submit"
          >
            {isLogin ? "Login" : "Register"}
          </button>
        </form>
      </div>

      <button
        className="text-md mb-3 w-80 bg-white text-black border-1 p-2 px-4 border-gray-400 font-4005 tracking-wide rounded-xl"
        onClick={() => setIsLogin(!isLogin)}
      >
        {isLogin ? "Register" : "Login"}
      </button>
    </div>
  );
}
