import { AdminApp } from "@/app/_components/admin-app";

export const metadata = {
  title: "Админка расписания",
  description: "Управление расписанием, отменами занятий и домашними заданиями группы",
};

export default function AdminPage() {
  return <AdminApp />;
}
