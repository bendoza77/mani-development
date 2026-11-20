import { notFound } from "next/navigation";

// Any path that matches no route renders the localized not-found page inside the [lang] root layout.
export default function CatchAll() {
  notFound();
}
