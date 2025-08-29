"use client";

import { useEffect, useState } from "react";
import BurgerMenu from "../components/BurgerMenu";
import Image from "next/image";

export default function ProfilePage() {
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("default");
  const [openaiKey, setOpenaiKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(
        `http://backend:8000/user/profile?token=${encodeURIComponent(token)}`,
      ).then((res) => res.json()),
      fetch(
        `http://backend:8000/user/openai_key?token=${encodeURIComponent(token)}`,
      ).then((res) => (res.ok ? res.json() : { openai_key: "" })),
    ])
      .then(([profileData, keyData]) => {
        setUsername(profileData.username);
        setEmail(profileData.email);
        setOpenaiKey(keyData.openai_key || "");
      })
      .catch(() => setMessage("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [token]);

  const updateProfile = async () => {
    if (!token) return;
    const res = await fetch(
      `http://backend:8000/user/profile?token=${encodeURIComponent(
        token,
      )}&username=${encodeURIComponent(username)}&email=${encodeURIComponent(
        email,
      )}&password=${encodeURIComponent(password)}`,
      { method: "PUT" },
    );
    if (res.ok) setMessage("Profile updated");
    else setMessage("Failed to update");
  };

  const updateOpenaiKey = async () => {
    if (!token) return;
    const res = await fetch(
      `http://backend:8000/user/update_openai_key?token=${encodeURIComponent(token)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openai_key: openaiKey }),
      },
    );

    if (res.ok) setMessage("OpenAI key updated");
    else setMessage("Failed to update OpenAI key");
  };

  const resetProfileContent = async () => {
    if (!token) return;
    if (!confirm("Are you sure? This will delete all your data.")) return;
    const res = await fetch(
      `http://backend:8000/user/reset_profile?token=${encodeURIComponent(
        token,
      )}`,
      { method: "DELETE" },
    );
    if (res.ok) setMessage("Profile content reset");
    else setMessage("Failed to reset");
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="">
      <div className="">
        <div className="z-1000 absolute top-4 right-4">
          <BurgerMenu token={token} />
        </div>
        <div className="w-full px-8 py-4">
          <a href="/home" className="text-black font-1001 text-6xl">
            Paperion
          </a>
        </div>
      </div>
      <div className="flex min-h-screen">
        {/* Left side */}
        <div className="relative w-1/2 overflow-hidden">
          <Image
            src="/icons/main-3.jpg"
            alt="main icon"
            width={1400}
            height={1400}
            className="absolute top-0 right-0 mt-30 mr-10 scale-90 object-cover"
          />
        </div>

        {/* Right side */}
        <div className="w-1/2 px-32 py-10">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-5001 tracing-wide mb-4">Profile</h1>
            {message && (
              <div className="mb-4 bg-blue-100/50 px-4 py-3 rounded-lg text-sm font-5001 tracking-wider text-black/60">
                {message}
              </div>
            )}
            <div className="mb-3 flex flex-col gap-1">
              <label className="block text-[14px] font-4002 tracking-wider mb-1">
                Username
              </label>
              <input
                value={username || ""}
                onChange={(e) => setUsername(e.target.value)}
                className="text-md mb-3 w-full border-1 p-2 px-4 border-gray-400 font-4005 tracking-wide rounded-md"
              />
            </div>

            <div className="mb-3">
              <label className="block text-[14px] font-4002 tracking-wider mb-1">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-md mb-3 w-full border-1 p-2 px-4 border-gray-400 font-4005 tracking-wide rounded-md"
              />
            </div>

            <div className="mb-4">
              <label className="block text-[14px] font-4002 tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-md mb-3 w-full border-1 p-2 px-4 border-gray-400 font-4005 tracking-wide rounded-md"
              />
            </div>

            <div className="mb-4">
              <label className="block text-[14px] font-4002 tracking-wider mb-1">
                OpenAI API Key
              </label>
              <div className="flex flex-row gap-4 items-center justify-center">
                <input
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="text-md w-full border-1 p-2 px-4 border-gray-400 font-4005 tracking-wide rounded-md"
                  placeholder="sk-am1RLw7XUWGXG..."
                />
                <button
                  onClick={updateOpenaiKey}
                  className="hover:cursor-pointer hover:opacity-80 rounded-full font-5002 bg-gray-500/50 px-4 py-2 text-white"
                >
                  Save
                </button>
              </div>
              <label className="mt-2 block text-[14px] text-gray-400 font-4002 tracking-wider mb-1">
                Note: Your API is encrypted in the database.
              </label>
            </div>
            <div className="flex flex-row items-center gap-4 justify-end">
              <button
                onClick={resetProfileContent}
                className="bg-red-200/30 border border-red-800/50 text-red-800/50 rounded-full text-md flex flex-row items-center justify-center gap-2 font-4005 mt-4 px-4 py-2 "
              >
                Reset All Content
              </button>
              <button
                onClick={updateProfile}
                className="bg-black hover:cursor-pointer hover:opacity-80 rounded-full text-md flex flex-row items-center justify-center gap-2 font-4005 mt-4 text-white px-4 py-2 "
              >
                <img
                  src="/icons/save-white.png"
                  alt="Save"
                  className="w-6 h-6"
                />
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
