import { Link } from "@tanstack/react-router";

export function NotFoundPage() {
  return (
    <section data-testid="not-found">
      <h1>No encontrado</h1>
      <p>Esa página no existe.</p>
      <Link to="/">Volver a los libros</Link>
    </section>
  );
}
