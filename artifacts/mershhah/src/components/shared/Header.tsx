import { UserNav } from "./UserNav";

export function Header() {
  return (
    <header className="flex h-12 items-center justify-end border-b border-gray-100 px-6 bg-gray-50/50">
      <UserNav />
    </header>
  );
}
