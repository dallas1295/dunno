import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <h1>Welcome to your Next.js App!</h1>
      <p>This is your homepage. You can start building your UI here.</p>
      <p>Your tRPC setup is ready.</p>

      <p>
        To run your application, use the command: <code>npm run dev</code> or{" "}
        <code>yarn dev</code>
      </p>

      <div style={{ marginTop: "2rem" }}>
        <Link href="/login" style={{ marginRight: "1rem" }}>
          Login
        </Link>
        <Link href="/register">Register</Link>
      </div>
    </div>
  );
}
