"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/react";

export default function Register() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const register = trpc.user.register.useMutation();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      const result = await register.mutateAsync(form);
      setMessage(result.message + " Welcome, " + result.user.username);
    } catch (err: any) {
      console.error("Register error:", err);
      setError(
        err?.shape?.message ||
          err?.data?.zodError?.formErrors?.join(", ") ||
          err?.message ||
          JSON.stringify(err) ||
          "Registration failed",
      );
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Register</h2>
      <input
        name="username"
        placeholder="Username"
        onChange={handleChange}
        value={form.username}
        minLength={3}
        required
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        onChange={handleChange}
        value={form.email}
        required
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        onChange={handleChange}
        value={form.password}
        minLength={8}
        required
      />
      <button type="submit" disabled={register.isPending}>
        {register.isPending ? "Registering..." : "Register"}
      </button>
      {message && <div style={{ color: "green" }}>{message}</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}
    </form>
  );
}
