"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import "./globals.css";
import AuthForm from "./auth/page";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) router.replace("/home");
  }, [router]);

  return (
    <div className="flex min-h-screen">
      {/* Left side */}
      <div className="flex flex-1 items-center justify-center">
        <AuthForm />
      </div>

      {/* Right side */}
      <div className="relative w-1/2">
        <Image
          src="/icons/main-2.png"
          alt="main icon"
          width={500}
          height={500}
          className="absolute top-0 right-0"
        />
      </div>
    </div>
  );
}
