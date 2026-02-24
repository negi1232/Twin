/**
 * @module main/msw-handler-generator
 * @description キャプチャされた API レスポンスから MSW ハンドラーと JSON ファイルを生成する。
 * 純粋関数として実装し、副作用（ファイル書き込み）は呼び出し側で行う。
 */

interface MswGeneratorInput {
  method: string;
  urlPattern: string;
  entries: Array<{
    response: {
      status: number;
      body: unknown;
    };
  }>;
}

interface MswGeneratorOutput {
  handlers: string;
  jsonFiles: Array<{ filename: string; content: string }>;
}

/**
 * URL パターンをファイル名に安全に変換する。
 * スラッシュをハイフンに置換し、先頭のハイフンを除去する。
 */
function sanitizePathForFilename(urlPattern: string): string {
  return urlPattern.replace(/\//g, '-').replace(/^-/, '');
}

/**
 * JSON ファイル名を生成する。
 * 形式: METHOD-path-segments.json (例: GET-api-users.json)
 */
function generateJsonFilename(method: string, urlPattern: string): string {
  const sanitized = sanitizePathForFilename(urlPattern);
  return `${method}-${sanitized}.json`;
}

/**
 * MSW v1 形式のハンドラーコードを生成する。
 */
function generateV1Handler(method: string, urlPattern: string, jsonFilename: string): string {
  const mswMethod = method.toLowerCase();
  return `  rest.${mswMethod}('${urlPattern}', (req, res, ctx) => {\n    return res(ctx.status(${method === 'DELETE' ? 204 : 200}), ctx.json(${jsonFilename.replace('.json', '')}[0]));\n  })`;
}

/**
 * MSW v2 形式のハンドラーコードを生成する。
 */
function generateV2Handler(method: string, urlPattern: string, jsonFilename: string): string {
  const mswMethod = method.toLowerCase();
  const varName = jsonFilename.replace('.json', '');
  return `  http.${mswMethod}('${urlPattern}', () => {\n    return HttpResponse.json(${varName}[0], { status: ${method === 'DELETE' ? 204 : 200} });\n  })`;
}

/**
 * キャプチャされた API グループから MSW ハンドラーファイルと JSON データファイルを生成する。
 *
 * @param groups - キャプチャされた API グループの配列
 * @param version - MSW バージョン ('v1' または 'v2')
 * @returns ハンドラーファイル内容と JSON ファイル配列
 */
function generateMswHandlers(groups: MswGeneratorInput[], version: 'v1' | 'v2'): MswGeneratorOutput {
  if (groups.length === 0) {
    const importLine = version === 'v1' ? "import { rest } from 'msw';" : "import { http, HttpResponse } from 'msw';";
    return {
      handlers: `${importLine}\n\nexport const handlers = [\n];\n`,
      jsonFiles: [],
    };
  }

  const jsonFiles: Array<{ filename: string; content: string }> = [];
  const handlerLines: string[] = [];
  const importLines: string[] = [];

  // MSW import
  if (version === 'v1') {
    importLines.push("import { rest } from 'msw';");
  } else {
    importLines.push("import { http, HttpResponse } from 'msw';");
  }

  for (const group of groups) {
    const jsonFilename = generateJsonFilename(group.method, group.urlPattern);
    const varName = jsonFilename.replace('.json', '');

    // JSON file with all response bodies
    const bodies = group.entries.map((e) => e.response.body);
    jsonFiles.push({
      filename: jsonFilename,
      content: JSON.stringify(bodies, null, 2),
    });

    // Import for JSON
    importLines.push(`import ${varName} from './mocks/${jsonFilename}';`);

    // Handler
    if (version === 'v1') {
      handlerLines.push(generateV1Handler(group.method, group.urlPattern, jsonFilename));
    } else {
      handlerLines.push(generateV2Handler(group.method, group.urlPattern, jsonFilename));
    }
  }

  const handlers = `${importLines.join('\n')}\n\nexport const handlers = [\n${handlerLines.join(',\n')},\n];\n`;

  return { handlers, jsonFiles };
}

export { generateMswHandlers, sanitizePathForFilename, generateJsonFilename };
