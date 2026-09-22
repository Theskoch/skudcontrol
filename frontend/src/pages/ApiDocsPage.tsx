import { useState } from "react";
import { Link } from "react-router-dom";

type Param = {
  name: string;
  in: "path" | "query";
  type: string;
  required?: boolean;
  default?: string;
  description: string;
};

type Field = { name: string; type: string; description: string };

type EndpointDef = {
  method: string;
  path: string;
  description: string;
  params?: Param[];
  responseFields: Field[];
  responseIsArray?: boolean;
  example: string;
  curlPath: string; // path (with query) appended to base for the curl example
};

const RANGE_PARAM: Param = {
  name: "range",
  in: "query",
  type: "enum",
  default: "today",
  description: "today · yesterday · week · month · year · all — период, за который считаются данные.",
};

const ENDPOINTS: EndpointDef[] = [
  {
    method: "GET",
    path: "/employees",
    description:
      "Список всех активных сотрудников с их текущими данными и средним временем на месте за скользящее окно (по умолчанию 30 дней, настраивается администратором).",
    responseFields: [
      { name: "id", type: "string", description: "ID сотрудника — используется в остальных запросах." },
      { name: "fullName", type: "string", description: "Идентификатор сотрудника (код, не ФИО)." },
      { name: "personnelNumber", type: "string | null", description: "Табельный номер, если есть." },
      { name: "serialNumber", type: "string | null", description: "Серийный номер устройства." },
      { name: "macAddress", type: "string | null", description: "MAC-адрес устройства." },
      { name: "avgMinutes", type: "number", description: "Среднее время на месте, в минутах (скользящее окно)." },
      {
        name: "colorBand",
        type: "green | yellow | red | none",
        description: "Цветовой статус: none — недостаточно данных.",
      },
    ],
    responseIsArray: true,
    example: `[
  {
    "id": "c543bc6c-...",
    "fullName": "p129",
    "personnelNumber": null,
    "serialNumber": null,
    "macAddress": "CE:17:D8:88:6B:41",
    "avgMinutes": 308,
    "colorBand": "yellow"
  }
]`,
    curlPath: "/employees",
  },
  {
    method: "GET",
    path: "/attendance",
    description:
      "Приход/уход по всем активным сотрудникам за выбранный период — отдельными списками для СКУД и для Wi-Fi (данные не объединяются, чтобы были видны оба источника как есть).",
    params: [RANGE_PARAM],
    responseFields: [
      { name: "employeeId", type: "string", description: "ID сотрудника." },
      { name: "fullName", type: "string", description: "Идентификатор сотрудника (код, не ФИО)." },
      { name: "skud[].date", type: "string (YYYY-MM-DD)", description: "День, к которому отнесена запись СКУД." },
      { name: "skud[].checkIn", type: "string | null (ISO)", description: "Время прихода по СКУД." },
      { name: "skud[].checkOut", type: "string | null (ISO)", description: "Время ухода по СКУД." },
      {
        name: "skud[].incomplete",
        type: "boolean",
        description: "true — пара приход/уход не закрыта (например, нет ухода).",
      },
      { name: "wifi[].date", type: "string (YYYY-MM-DD)", description: "День сессии Wi-Fi." },
      { name: "wifi[].connectedAt", type: "string (ISO)", description: "Время подключения к Wi-Fi." },
      {
        name: "wifi[].disconnectedAt",
        type: "string | null (ISO)",
        description: "Время отключения; null — ещё подключён.",
      },
      { name: "wifi[].incomplete", type: "boolean", description: "true — сессия ещё не закрыта." },
    ],
    responseIsArray: true,
    example: `[
  {
    "employeeId": "c543bc6c-...",
    "fullName": "p129",
    "skud": [
      { "date": "2026-09-17", "checkIn": "2026-09-17T07:44:00.000Z", "checkOut": null, "incomplete": true }
    ],
    "wifi": [
      { "date": "2026-09-17", "connectedAt": "2026-09-17T07:45:49.000Z", "disconnectedAt": null, "incomplete": true }
    ]
  }
]`,
    curlPath: "/attendance?range=week",
  },
  {
    method: "GET",
    path: "/employees/:id/average",
    description:
      "Среднее время на месте и отработанные минуты одного сотрудника за конкретный период (не скользящее окно, а именно выбранный range).",
    params: [
      { name: "id", in: "path", type: "string", required: true, description: "ID сотрудника из /employees." },
      RANGE_PARAM,
    ],
    responseFields: [
      { name: "employeeId", type: "string", description: "ID сотрудника." },
      { name: "range", type: "string", description: "Период, который был использован для расчёта." },
      { name: "averageMinutes", type: "number", description: "Среднее время в минутах за этот период." },
      { name: "workedMinutes", type: "number", description: "Суммарно отработано минут за период." },
      {
        name: "activeDays",
        type: "number",
        description: "Число дней в периоде, за которые есть хоть какие-то данные.",
      },
    ],
    example: `{
  "employeeId": "c543bc6c-...",
  "range": "month",
  "averageMinutes": 308,
  "workedMinutes": 925,
  "activeDays": 3
}`,
    curlPath: "/employees/<id>/average?range=month",
  },
  {
    method: "GET",
    path: "/employees/:id/attendance",
    description:
      "Приход/уход одного сотрудника за период — отдельно СКУД и отдельно Wi-Fi. Формат такой же, как у /attendance, но для одного сотрудника.",
    params: [
      { name: "id", in: "path", type: "string", required: true, description: "ID сотрудника из /employees." },
      RANGE_PARAM,
    ],
    responseFields: [
      { name: "employeeId", type: "string", description: "ID сотрудника." },
      { name: "fullName", type: "string", description: "Идентификатор сотрудника (код, не ФИО)." },
      { name: "skud[].date", type: "string (YYYY-MM-DD)", description: "День записи СКУД." },
      { name: "skud[].checkIn", type: "string | null (ISO)", description: "Время прихода по СКУД." },
      { name: "skud[].checkOut", type: "string | null (ISO)", description: "Время ухода по СКУД." },
      { name: "skud[].incomplete", type: "boolean", description: "Пара приход/уход не закрыта." },
      { name: "wifi[].date", type: "string (YYYY-MM-DD)", description: "День сессии Wi-Fi." },
      { name: "wifi[].connectedAt", type: "string (ISO)", description: "Время подключения к Wi-Fi." },
      {
        name: "wifi[].disconnectedAt",
        type: "string | null (ISO)",
        description: "Время отключения; null — ещё подключён.",
      },
      { name: "wifi[].incomplete", type: "boolean", description: "Сессия ещё не закрыта." },
    ],
    example: `{
  "employeeId": "c543bc6c-...",
  "fullName": "p129",
  "skud": [
    { "date": "2026-09-16", "checkIn": "2026-09-16T07:44:00.000Z", "checkOut": "2026-09-16T15:12:00.000Z", "incomplete": false }
  ],
  "wifi": [
    { "date": "2026-09-16", "connectedAt": "2026-09-16T07:50:25.000Z", "disconnectedAt": "2026-09-16T15:15:20.179Z", "incomplete": false }
  ]
}`,
    curlPath: "/employees/<id>/attendance?range=today",
  },
  {
    method: "GET",
    path: "/employees/by-mac/:mac",
    description:
      "Найти сотрудника по MAC-адресу устройства. Регистр и разделители (: или -) не важны — адрес нормализуется перед поиском.",
    params: [
      {
        name: "mac",
        in: "path",
        type: "string",
        required: true,
        description: "MAC-адрес, например AA:BB:CC:DD:EE:FF или aa-bb-cc-dd-ee-ff.",
      },
    ],
    responseFields: [
      { name: "id", type: "string", description: "ID сотрудника — используется в остальных запросах." },
      { name: "fullName", type: "string", description: "Идентификатор сотрудника (код, не ФИО)." },
      { name: "personnelNumber", type: "string | null", description: "Табельный номер, если есть." },
      { name: "serialNumber", type: "string | null", description: "Серийный номер устройства." },
      {
        name: "macAddress",
        type: "string",
        description: "MAC-адрес в нормализованном виде (заглавные буквы, через двоеточие).",
      },
    ],
    example: `{
  "id": "c543bc6c-...",
  "fullName": "p129",
  "personnelNumber": null,
  "serialNumber": null,
  "macAddress": "CE:17:D8:88:6B:41"
}`,
    curlPath: "/employees/by-mac/AA:BB:CC:DD:EE:FF",
  },
];

const ERROR_CODES = [
  { code: "401", description: "Нет заголовка X-API-Key, либо ключ неверный / отозван / истёк." },
  { code: "400", description: "Некорректный параметр — например, невалидный range или MAC-адрес." },
  { code: "404", description: "Сотрудник с таким id / MAC не найден или неактивен." },
];

function buildClaudeMarkdown(base: string): string {
  const lines: string[] = [];
  lines.push("# SkudControl — публичный API учёта прихода/ухода сотрудников");
  lines.push("");
  lines.push(
    "Это справка для ассистента (Claude): ниже описан весь доступный HTTP API, чтобы можно было сразу писать интеграции без дополнительных вопросов.",
  );
  lines.push("");
  lines.push(`Базовый адрес: \`${base}\``);
  lines.push("");
  lines.push("Все запросы — только чтение (GET). Авторизация: заголовок `X-API-Key: <ключ>` на каждом запросе.");
  lines.push("Без ключа или с неверным/отозванным/истёкшим ключом сервер отвечает 401.");
  lines.push("");
  lines.push("## Коды ошибок");
  for (const e of ERROR_CODES) lines.push(`- **${e.code}** — ${e.description}`);
  lines.push("");

  for (const ep of ENDPOINTS) {
    lines.push(`## ${ep.method} ${ep.path}`);
    lines.push("");
    lines.push(ep.description);
    lines.push("");
    if (ep.params && ep.params.length > 0) {
      lines.push("Параметры:");
      for (const p of ep.params) {
        const req = p.required ? "обязателен" : p.default ? `необязателен, по умолчанию ${p.default}` : "необязателен";
        lines.push(`- \`${p.name}\` (${p.in === "path" ? "путь" : "query"}, ${p.type}, ${req}) — ${p.description}`);
      }
      lines.push("");
    }
    lines.push(`Поля ${ep.responseIsArray ? "объекта в ответе (ответ — массив таких объектов)" : "ответа"}:`);
    for (const f of ep.responseFields) {
      lines.push(`- \`${f.name}\`: ${f.type} — ${f.description}`);
    }
    lines.push("");
    lines.push("Пример ответа:");
    lines.push("```json");
    lines.push(ep.example);
    lines.push("```");
    lines.push("");
    lines.push("Пример запроса:");
    lines.push("```bash");
    lines.push(`curl -H "X-API-Key: <ключ>" "${base}${ep.curlPath}"`);
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

function ParamsTable({ params }: { params: Param[] }) {
  return (
    <table className="mb-4 w-full border-collapse text-left text-xs">
      <thead>
        <tr className="border-b border-line-hairline text-ink-muted">
          <th className="py-1.5 pr-3 font-medium">Параметр</th>
          <th className="py-1.5 pr-3 font-medium">Где</th>
          <th className="py-1.5 pr-3 font-medium">Тип</th>
          <th className="py-1.5 pr-3 font-medium">Обязателен</th>
          <th className="py-1.5 font-medium">Описание</th>
        </tr>
      </thead>
      <tbody>
        {params.map((p) => (
          <tr key={p.name} className="border-b border-line-hairline/60 last:border-0">
            <td className="py-1.5 pr-3 font-mono text-ink-primary">{p.name}</td>
            <td className="py-1.5 pr-3 text-ink-secondary">{p.in === "path" ? "путь" : "query"}</td>
            <td className="py-1.5 pr-3 font-mono text-ink-secondary">{p.type}</td>
            <td className="py-1.5 pr-3 text-ink-secondary">
              {p.required ? "да" : p.default ? `нет, по умолчанию ${p.default}` : "нет"}
            </td>
            <td className="py-1.5 text-ink-secondary">{p.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FieldsTable({ title, fields }: { title: string; fields: Field[] }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-xs font-medium text-ink-secondary">{title}</div>
      <table className="w-full border-collapse text-left text-xs">
        <tbody>
          {fields.map((f) => (
            <tr key={f.name} className="border-b border-line-hairline/60 last:border-0">
              <td className="w-1/3 py-1.5 pr-3 font-mono text-ink-primary">{f.name}</td>
              <td className="w-24 py-1.5 pr-3 font-mono text-ink-secondary">{f.type}</td>
              <td className="py-1.5 text-ink-secondary">{f.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Endpoint({ ep, base }: { ep: EndpointDef; base: string }) {
  return (
    <div className="rounded-xl border border-line-hairline bg-surface p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-accent-violet/15 px-2 py-0.5 text-xs font-semibold text-accent-violet">
          {ep.method}
        </span>
        <code className="font-mono text-sm text-ink-primary">{ep.path}</code>
      </div>
      <p className="mb-4 text-sm text-ink-secondary">{ep.description}</p>

      {ep.params && ep.params.length > 0 && (
        <>
          <div className="mb-1.5 text-xs font-medium text-ink-secondary">Параметры</div>
          <ParamsTable params={ep.params} />
        </>
      )}

      <FieldsTable
        title={ep.responseIsArray ? "Поля объекта в ответе (массив таких объектов)" : "Поля ответа"}
        fields={ep.responseFields}
      />

      <div className="mb-1.5 text-xs font-medium text-ink-secondary">Пример ответа</div>
      <pre className="mb-4 overflow-x-auto rounded-lg bg-surface-raised p-3 text-xs text-ink-secondary">
        <code>{ep.example}</code>
      </pre>

      <div className="mb-1.5 text-xs font-medium text-ink-secondary">Пример запроса</div>
      <pre className="overflow-x-auto rounded-lg bg-surface-raised p-3 text-xs text-ink-secondary">
        <code>{`curl -H "X-API-Key: <ключ>" "${base}${ep.curlPath}"`}</code>
      </pre>
    </div>
  );
}

export function ApiDocsPage() {
  const base = `${window.location.origin}/api/public/v1`;
  const [copied, setCopied] = useState(false);

  async function copyForClaude() {
    await navigator.clipboard.writeText(buildClaudeMarkdown(base));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link to="/api-settings" className="text-sm text-ink-muted hover:text-ink-primary">
          ← API
        </Link>
        <button
          onClick={copyForClaude}
          className="rounded-lg border border-line-hairline px-3 py-1.5 text-sm text-ink-secondary transition hover:border-accent-violet hover:text-ink-primary"
        >
          {copied ? "Скопировано" : "Скопировать доку для Claude"}
        </button>
      </div>

      <h1 className="mt-4 mb-1 text-xl font-semibold tracking-tight">Документация API</h1>
      <div className="mb-6 space-y-1 text-sm text-ink-muted">
        <p>
          Все запросы — <strong className="text-ink-secondary">только чтение</strong> (GET). Авторизация —
          заголовок <code className="font-mono">X-API-Key: &lt;ключ&gt;</code> на каждом запросе.
        </p>
        <p>
          Без ключа или с неверным/отозванным/истёкшим ключом сервер отвечает{" "}
          <code className="font-mono">401</code>. Диапазон <code className="font-mono">range</code> — общий
          параметр почти везде, см. таблицу параметров у каждого запроса.
        </p>
        <p>
          Кнопка «Скопировать доку для Claude» вверху копирует всё это же в виде текста — можно вставить в
          новый чат с Claude, чтобы он сразу понял, как устроен API, без пересказа вручную.
        </p>
      </div>

      <div className="space-y-6">
        {ENDPOINTS.map((ep) => (
          <Endpoint key={ep.path} ep={ep} base={base} />
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-line-hairline bg-surface p-5 text-xs text-ink-muted">
        <div className="mb-1.5 font-medium text-ink-secondary">Коды ошибок</div>
        <table className="w-full border-collapse text-left">
          <tbody>
            {ERROR_CODES.map((e, i) => (
              <tr key={e.code} className={i < ERROR_CODES.length - 1 ? "border-b border-line-hairline/60" : ""}>
                <td className="w-20 py-1.5 pr-3 font-mono text-ink-primary">{e.code}</td>
                <td className="py-1.5">{e.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
