import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export function SignInForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // This will validate the credentials and return if they're valid
  const validateCredentials = useMutation(api.auth.validateCredentials);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      console.log("Checking credentials for:", { username });
      
      // Validate the credentials
      const result = await validateCredentials({
        username,
        password,
      });
      
      if (result.valid) {
        console.log("Credentials are valid!");
        
        // Store authentication in localStorage
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("userId", result.userId ? result.userId.toString() : "");
        
        // Refresh the page to update the authenticated state
        window.location.reload();
      } else {
        console.error("Invalid credentials:", result.message);
        setError("خطأ في تسجيل الدخول. يرجى التحقق من اسم المستخدم وكلمة المرور.");
      }
    } catch (error) {
      console.error("Sign-in error:", error);
      setError("خطأ في تسجيل الدخول. يرجى التحقق من اسم المستخدم وكلمة المرور.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">اسم المستخدم</label>
        <input
          required
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-2 border rounded-md"
          disabled={isLoading}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">كلمة المرور</label>
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded-md"
          disabled={isLoading}
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 disabled:bg-blue-300"
        disabled={isLoading}
      >
        {isLoading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
      </button>
    </form>
  );
}
