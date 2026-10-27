import { createFileRoute } from "@tanstack/react-router";
import { SavedPage } from "../web/pages/SavedPage";

export const Route = createFileRoute("/guardados")({
  component: SavedPage,
});
