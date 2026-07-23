
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    User, 
    Mail, 
    Shield, 
    MoreHorizontal,
    UserCheck,
    UserMinus
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface UsersTableProps {
  users: any[];
}

export function UsersTable({ users }: UsersTableProps) {
  
  const handleAction = (action: string, name: string) => {
    toast({ title: action, description: `تم تنفيذ الإجراء على المستخدم ${name}` });
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <Table dir="rtl">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-right">المستخدم</TableHead>
              <TableHead className="text-right">البريد الإلكتروني</TableHead>
              <TableHead className="text-right">الدور</TableHead>
              <TableHead className="text-right">حالة الحساب</TableHead>
              <TableHead className="text-right">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length > 0 ? users.map((user) => (
              <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground border">
                        <User className="h-5 w-5" />
                    </div>
                    <div className="font-bold">{user.name}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {user.email}
                    </div>
                </TableCell>
                <TableCell className="text-right">
                    <Badge variant="outline" className="gap-1 flex-row-reverse border-primary/20 text-primary">
                        <Shield className="h-3 w-3" />
                        {user.role === 'admin' ? 'مدير عام' : 'صاحب مطعم'}
                    </Badge>
                </TableCell>
                <TableCell className="text-right">
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none">
                        نشط
                    </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="text-right">
                      <DropdownMenuLabel>إدارة الحساب</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleAction('تغيير الدور', user.name)}>
                        <Shield className="ms-2 h-4 w-4" /> تغيير الصلاحيات
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAction('تعطيل', user.name)} className="text-destructive">
                        <UserMinus className="ms-2 h-4 w-4" /> تعطيل الحساب
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">
                    لا يوجد مستخدمون حالياً
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
