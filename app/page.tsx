// This is your application's homepage (rendered at the root URL '/').
// You can build your UI here or import other components.

// Example of how to use your tRPC client (assuming you have a 'user' router with a 'hello' procedure)
// import { trpc } from '@/server/trpc/react';

export default function HomePage() {
  // Example of making a tRPC query (uncomment and adapt to your actual procedures)
  // const helloQuery = trpc.user.hello.useQuery();

  return (
    <div>
      <h1>Welcome to your Next.js App!</h1>
      <p>This is your homepage. You can start building your UI here.</p>
      <p>Your tRPC setup is ready.</p>

      {/* Example of displaying data from a tRPC query */}
      {/* {helloQuery.data && <p>{helloQuery.data.greeting}</p>} */}

      <p>To run your application, use the command: `npm run dev` or `yarn dev`</p>
    </div>
  );
}
