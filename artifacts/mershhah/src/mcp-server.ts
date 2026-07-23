import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const server = new Server(
  {
    name: "mershhah-master-control",
    version: "3.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 1. تعريف الأدوات (Tools) لمانوس
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_project_structure",
        description: "رؤية كافة ملفات المشروع والمجلدات",
        inputSchema: { type: "object", properties: { path: { type: "string" } } },
      },
      {
        name: "read_project_file",
        description: "قراءة محتوى أي ملف برمجي (الكود)",
        inputSchema: {
          type: "object",
          properties: { filePath: { type: "string" } },
          required: ["filePath"],
        },
      },
      {
        name: "write_project_file",
        description: "تعديل أو إنشاء ملف كود جديد في المشروع",
        inputSchema: {
          type: "object",
          properties: {
            filePath: { type: "string" },
            content: { type: "string" }
          },
          required: ["filePath", "content"],
        },
      },
      {
        name: "execute_command",
        description: "تنفيذ أمر تيرمينال (مثل npm install أو git status)",
        inputSchema: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"],
        },
      }
    ],
  };
});

// 2. تنفيذ العمليات (Handlers)
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const rootDir = process.cwd();

  try {
    switch (name) {
      case "list_project_structure": {
        const targetPath = path.join(rootDir, (args?.path as string) || "");
        const files = await fs.readdir(targetPath, { recursive: true });
        return { content: [{ type: "text", text: JSON.stringify(files.filter(f => !f.includes("node_modules") && !f.includes(".git")), null, 2) }] };
      }

      case "read_project_file": {
        const fullPath = path.join(rootDir, args?.filePath as string);
        const content = await fs.readFile(fullPath, "utf-8");
        return { content: [{ type: "text", text: content }] };
      }

      case "write_project_file": {
        const fullPath = path.join(rootDir, args?.filePath as string);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, args?.content as string, "utf-8");
        return { content: [{ type: "text", text: `Success: File ${args?.filePath} updated.` }] };
      }

      case "execute_command": {
        const { stdout, stderr } = await execAsync(args?.command as string);
        return { content: [{ type: "text", text: stdout || stderr }] };
      }

      default:
        throw new Error("Unknown tool");
    }
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Mershhah Master Control Server running...");
}

main().catch(console.error);
