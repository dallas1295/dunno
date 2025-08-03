"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/react"; // Adjust if needed

export default function Login() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [message, setMessage] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const login = trpc.user.login.useMutation();
  const logout = trpc.user.logout.useMutation();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoggedIn(false);
    try {
      const result = await login.mutateAsync(form);
      if ("requireTwoFactor" in result && result.requireTwoFactor) {
        setMessage(
          "2FA required! Temp token: " +
            result.tempToken +
            " (recovery available: " +
            result.recoveryAvailable +
            ")",
        );
      } else if ("user" in result) {
        setMessage("Login successful! Welcome, " + result.user.username);
        setLoggedIn(true);
      } else {
        setMessage("Unknown response from server");
      }
    } catch (err: any) {
      setMessage(err.message || "Login failed");
    }
  };

  const handleLogout = async () => {
    setMessage("");
    try {
      const result = await logout.mutateAsync();
      setMessage(result.message || "Logged out!");
      setLoggedIn(false);
    } catch (err: any) {
      setMessage(err.message || "Logout failed");
    }
  };

  return (
    <div>
      {!loggedIn ? (
        <form onSubmit={handleSubmit}>
          <h2>Login</h2>
          <input
            name="username"
            placeholder="Username"
            onChange={handleChange}
            value={form.username}
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            onChange={handleChange}
            value={form.password}
          />
          <button type="submit">Login</button>
        </form>
      ) : (
        <button onClick={handleLogout} style={{ marginTop: "1rem" }}>
          Logout
        </button>
      )}
      {message && <div>{message}</div>}
    </div>
  );
}
