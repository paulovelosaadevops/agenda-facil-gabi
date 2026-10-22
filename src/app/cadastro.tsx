import { AuthForm } from "@/components/auth-form";
import { ClientSignup } from "@/components/client-signup";
import { useAuth } from "@/lib/auth";

/** Cadastro de clientes. Na primeira instalação (sem estúdio), é a conta da Gabi. */
export default function Cadastro() {
  const { studioExists } = useAuth();
  return studioExists ? <ClientSignup /> : <AuthForm mode="signup" />;
}
