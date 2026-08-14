import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/feedback")({
  beforeLoad: () => {
    throw redirect({ to: "/support" });
  },
});
