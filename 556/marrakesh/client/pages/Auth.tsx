import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from as string | undefined;

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    try {
      setLoading(true);
      await login(email, password);
      toast.success("Вход выполнен");
      navigate(from || "/sessions");
    } catch (e: any) {
      toast.error(e.message || "Ошибка авторизации");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name"));
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    try {
      setLoading(true);
      await register(name, email, password);
      toast.success("Регистрация успешна");
      navigate("/sessions");
    } catch (e: any) {
      toast.error(e.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-center text-3xl font-extrabold">Добро пожаловать!</h1>
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Вход</TabsTrigger>
          <TabsTrigger value="register">Регистрация</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form onSubmit={handleLogin} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="name@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button disabled={loading} className="w-full">Войти</Button>
          </form>
        </TabsContent>
        <TabsContent value="register">
          <form onSubmit={handleRegister} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Имя</Label>
              <Input id="name" name="name" required placeholder="Игрок" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email2">Email</Label>
              <Input id="email2" name="email" type="email" required placeholder="name@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password2">Пароль</Label>
              <Input id="password2" name="password" type="password" required />
            </div>
            <Button disabled={loading} className="w-full">Зарегистрироваться</Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
