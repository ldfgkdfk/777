import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <h1 className="mb-2 text-5xl font-extrabold">404</h1>
        <p className="mb-4 text-muted-foreground">Страница не найдена</p>
        <a href="/" className="text-primary underline-offset-4 hover:underline">На главную</a>
      </div>
    </div>
  );
};

export default NotFound;
