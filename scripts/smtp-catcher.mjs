import { appendFileSync, writeFileSync } from "node:fs";
import net from "node:net";

const port = Number(process.env.SMTP_CATCHER_PORT || 2525);
const file = process.env.SMTP_CATCHER_PATH || "/tmp/hn-e2e-mailbox.log";
const ready = process.env.SMTP_CATCHER_READY || "/tmp/hn-e2e-smtp.ready";

const server = net.createServer((socket) => {
  socket.setEncoding("utf8");
  let buffer = "";
  let dataMode = false;
  let message = "";
  socket.write("220 localhost ESMTP\r\n");

  function command(line) {
    const cmd = line.toUpperCase();
    if (cmd.startsWith("EHLO") || cmd.startsWith("HELO")) {
      socket.write("250-localhost\r\n250 OK\r\n");
      return;
    }
    if (cmd.startsWith("DATA")) {
      dataMode = true;
      message = "";
      socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
      return;
    }
    if (cmd.startsWith("QUIT")) {
      socket.write("221 Bye\r\n");
      socket.end();
      return;
    }
    socket.write("250 OK\r\n");
  }

  socket.on("data", (chunk) => {
    buffer += chunk;
    if (!dataMode) {
      let end = buffer.indexOf("\r\n");
      while (end !== -1 && !dataMode) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        command(line);
        end = buffer.indexOf("\r\n");
      }
    }
    if (dataMode) {
      message += buffer;
      buffer = "";
      const end = message.indexOf("\r\n.\r\n");
      if (end !== -1) {
        appendFileSync(file, `${message.slice(0, end)}\n---\n`);
        buffer = message.slice(end + 5);
        message = "";
        dataMode = false;
        socket.write("250 OK\r\n");
        let lineEnd = buffer.indexOf("\r\n");
        while (lineEnd !== -1 && !dataMode) {
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 2);
          command(line);
          lineEnd = buffer.indexOf("\r\n");
        }
      }
    }
  });
});

server.on("error", (error) => {
  console.error(error instanceof Error ? error.message : "smtp catcher failed");
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  writeFileSync(ready, "ok");
});
