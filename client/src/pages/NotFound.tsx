import { Button } from "@/components/ui/button";
import { Home24Regular as Home } from "@fluentui/react-icons";
import { useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function NotFound() {
  useDocumentTitle("Page Not Found · Hoyas Concession");
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4" style={{ backgroundColor: "#f5f7fa" }}>
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 w-20 h-20 rounded-2xl flex items-center justify-center shadow-md" style={{ backgroundColor: "#003087" }}>
          <img src="/logo.png" alt="Hoyas Youth Sports" className="w-14 h-14 object-contain" />
        </div>
        <p className="text-sm font-bold tracking-widest mb-1" style={{ color: "#009A44", fontFamily: "Montserrat, sans-serif" }}>HOYAS CONCESSION</p>
        <h1 className="text-6xl font-extrabold mb-2" style={{ color: "#003087", fontFamily: "Montserrat, sans-serif" }}>404</h1>
        <h2 className="text-xl font-semibold text-gray-800 mb-3">Page not found</h2>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Sorry, we couldn't find that page. It may have been moved, or the link may be out of date.
        </p>
        <Button
          onClick={() => setLocation("/")}
          className="text-white px-6 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all"
          style={{ backgroundColor: "#003087" }}
        >
          <Home className="w-4 h-4 mr-2" />
          Back to volunteer sign-up
        </Button>
      </div>
    </div>
  );
}
