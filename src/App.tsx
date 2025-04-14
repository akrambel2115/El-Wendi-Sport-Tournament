import { Authenticated, Unauthenticated } from "convex/react";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { PublicInterface } from "./components/public/PublicInterface";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export default function App() {
  const [isAuthenticatedLocally, setIsAuthenticatedLocally] = useState(false);
  const createDefaultAdmin = useMutation(api.init.createDefaultAdmin);

  useEffect(() => {
    // Run the createDefaultAdmin mutation when the app loads
    // This will only create the admin if it doesn't already exist
    createDefaultAdmin()
      .then(() => console.log("Default admin setup completed"))
      .catch(err => console.error("Failed to set up default admin:", err));
      
    // Check if user is authenticated via localStorage (default admin)
    const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
    setIsAuthenticatedLocally(isAuthenticated);
  }, [createDefaultAdmin]);

  function handleSignOut() {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userId");
    setIsAuthenticatedLocally(false);
  }

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm p-4 flex justify-between items-center border-b">
        <div className="flex items-center">
          <img 
            src="/el_wendi_sport.png" 
            alt="الوندي سبور" 
            className="h-8 w-auto mr-2" 
          />
          <h2 className="text-xl font-semibold">الوندي سبور</h2>
        </div>
        {isAuthenticatedLocally && (
          <button onClick={handleSignOut} className="text-sm text-red-500">تسجيل الخروج</button>
        )}
        <Authenticated>
          <SignOutButton />
        </Authenticated>
      </header>
      
      <main className="flex-1">
        {isAuthenticatedLocally ? (
          <AdminDashboard />
        ) : (
          <>
            <Authenticated>
              <AdminDashboard />
            </Authenticated>
            <Unauthenticated>
              <PublicInterface />
            </Unauthenticated>
          </>
        )}
      </main>
    </div>
  );
}
