interface StatusMessageProps {
  status?: string | string[];
  message?: string | string[];
}

function decodeMaybe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function StatusMessage({ status, message }: StatusMessageProps) {
  const statusValue = Array.isArray(status) ? status[0] : status;
  const messageValue = Array.isArray(message) ? message[0] : message;

  if (!messageValue) {
    return null;
  }

  const mode = statusValue === "error" ? "error" : "success";

  return <div className={`status-box ${mode}`}>{decodeMaybe(messageValue)}</div>;
}
