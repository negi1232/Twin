export {};

const { generateMswHandlers, sanitizePathForFilename, generateJsonFilename } = require('../../src/main/msw-handler-generator');

describe('msw-handler-generator', () => {
  // --- sanitizePathForFilename ---
  describe('sanitizePathForFilename', () => {
    test('replaces slashes with hyphens', () => {
      expect(sanitizePathForFilename('/api/users')).toBe('api-users');
    });

    test('handles root path', () => {
      expect(sanitizePathForFilename('/')).toBe('');
    });

    test('handles nested paths', () => {
      expect(sanitizePathForFilename('/api/v1/auth/login')).toBe('api-v1-auth-login');
    });

    test('handles path without leading slash', () => {
      expect(sanitizePathForFilename('api/users')).toBe('api-users');
    });
  });

  // --- generateJsonFilename ---
  describe('generateJsonFilename', () => {
    test('generates filename with method and sanitized path', () => {
      expect(generateJsonFilename('GET', '/api/users')).toBe('GET-api-users.json');
    });

    test('generates filename for POST method', () => {
      expect(generateJsonFilename('POST', '/api/auth/login')).toBe('POST-api-auth-login.json');
    });

    test('generates filename for DELETE method', () => {
      expect(generateJsonFilename('DELETE', '/api/users')).toBe('DELETE-api-users.json');
    });

    test('generates filename for PUT method', () => {
      expect(generateJsonFilename('PUT', '/api/users')).toBe('PUT-api-users.json');
    });

    test('generates filename for PATCH method', () => {
      expect(generateJsonFilename('PATCH', '/api/users')).toBe('PATCH-api-users.json');
    });
  });

  // --- generateMswHandlers ---
  describe('generateMswHandlers', () => {
    const singleGroup = [{
      method: 'GET',
      urlPattern: '/api/users',
      entries: [{
        response: { status: 200, body: [{ id: 1, name: 'Alice' }] },
      }],
    }];

    const multipleGroups = [
      {
        method: 'GET',
        urlPattern: '/api/users',
        entries: [
          { response: { status: 200, body: [{ id: 1, name: 'Alice' }] } },
          { response: { status: 200, body: [{ id: 2, name: 'Bob' }] } },
        ],
      },
      {
        method: 'POST',
        urlPattern: '/api/auth/login',
        entries: [
          { response: { status: 200, body: { token: 'abc123' } } },
        ],
      },
    ];

    // --- v1 output ---
    describe('v1 output', () => {
      test('generates v1 handler with rest import', () => {
        const result = generateMswHandlers(singleGroup, 'v1');
        expect(result.handlers).toContain("import { rest } from 'msw';");
      });

      test('generates v1 handler function with rest.get', () => {
        const result = generateMswHandlers(singleGroup, 'v1');
        expect(result.handlers).toContain("rest.get('/api/users'");
        expect(result.handlers).toContain('res(ctx.status(200), ctx.json(');
      });

      test('generates JSON import for v1', () => {
        const result = generateMswHandlers(singleGroup, 'v1');
        expect(result.handlers).toContain("import GET-api-users from './mocks/GET-api-users.json';");
      });

      test('generates handlers array export for v1', () => {
        const result = generateMswHandlers(singleGroup, 'v1');
        expect(result.handlers).toContain('export const handlers = [');
      });

      test('generates multiple handlers for v1', () => {
        const result = generateMswHandlers(multipleGroups, 'v1');
        expect(result.handlers).toContain("rest.get('/api/users'");
        expect(result.handlers).toContain("rest.post('/api/auth/login'");
      });

      test('uses status 204 for DELETE method in v1', () => {
        const deleteGroup = [{
          method: 'DELETE',
          urlPattern: '/api/users',
          entries: [{ response: { status: 204, body: null } }],
        }];
        const result = generateMswHandlers(deleteGroup, 'v1');
        expect(result.handlers).toContain('ctx.status(204)');
      });
    });

    // --- v2 output ---
    describe('v2 output', () => {
      test('generates v2 handler with http/HttpResponse import', () => {
        const result = generateMswHandlers(singleGroup, 'v2');
        expect(result.handlers).toContain("import { http, HttpResponse } from 'msw';");
      });

      test('generates v2 handler function with http.get', () => {
        const result = generateMswHandlers(singleGroup, 'v2');
        expect(result.handlers).toContain("http.get('/api/users'");
        expect(result.handlers).toContain('HttpResponse.json(');
      });

      test('generates JSON import for v2', () => {
        const result = generateMswHandlers(singleGroup, 'v2');
        expect(result.handlers).toContain("import GET-api-users from './mocks/GET-api-users.json';");
      });

      test('generates multiple handlers for v2', () => {
        const result = generateMswHandlers(multipleGroups, 'v2');
        expect(result.handlers).toContain("http.get('/api/users'");
        expect(result.handlers).toContain("http.post('/api/auth/login'");
      });

      test('uses status 204 for DELETE method in v2', () => {
        const deleteGroup = [{
          method: 'DELETE',
          urlPattern: '/api/users',
          entries: [{ response: { status: 204, body: null } }],
        }];
        const result = generateMswHandlers(deleteGroup, 'v2');
        expect(result.handlers).toContain('status: 204');
      });
    });

    // --- JSON files ---
    describe('JSON file generation', () => {
      test('generates JSON file with all response bodies as array', () => {
        const result = generateMswHandlers(multipleGroups, 'v2');
        expect(result.jsonFiles).toHaveLength(2);

        const usersFile = result.jsonFiles.find((f: any) => f.filename === 'GET-api-users.json');
        expect(usersFile).toBeDefined();
        const parsed = JSON.parse(usersFile.content);
        expect(parsed).toHaveLength(2);
        expect(parsed[0]).toEqual([{ id: 1, name: 'Alice' }]);
        expect(parsed[1]).toEqual([{ id: 2, name: 'Bob' }]);
      });

      test('generates JSON file for POST endpoint', () => {
        const result = generateMswHandlers(multipleGroups, 'v2');
        const loginFile = result.jsonFiles.find((f: any) => f.filename === 'POST-api-auth-login.json');
        expect(loginFile).toBeDefined();
        const parsed = JSON.parse(loginFile.content);
        expect(parsed).toHaveLength(1);
        expect(parsed[0]).toEqual({ token: 'abc123' });
      });

      test('generates correctly formatted JSON', () => {
        const result = generateMswHandlers(singleGroup, 'v1');
        expect(result.jsonFiles).toHaveLength(1);
        expect(result.jsonFiles[0].filename).toBe('GET-api-users.json');
        // Should be pretty-printed (2 space indent)
        expect(result.jsonFiles[0].content).toContain('\n');
      });
    });

    // --- Empty input ---
    describe('empty input', () => {
      test('returns empty handlers for v1 with no groups', () => {
        const result = generateMswHandlers([], 'v1');
        expect(result.handlers).toContain("import { rest } from 'msw';");
        expect(result.handlers).toContain('export const handlers = [');
        expect(result.jsonFiles).toHaveLength(0);
      });

      test('returns empty handlers for v2 with no groups', () => {
        const result = generateMswHandlers([], 'v2');
        expect(result.handlers).toContain("import { http, HttpResponse } from 'msw';");
        expect(result.handlers).toContain('export const handlers = [');
        expect(result.jsonFiles).toHaveLength(0);
      });
    });

    // --- Various HTTP methods ---
    describe('HTTP method variations', () => {
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

      for (const method of methods) {
        test(`generates v2 handler for ${method} method`, () => {
          const group = [{
            method,
            urlPattern: '/api/resource',
            entries: [{ response: { status: 200, body: { ok: true } } }],
          }];
          const result = generateMswHandlers(group, 'v2');
          expect(result.handlers).toContain(`http.${method.toLowerCase()}('/api/resource'`);
        });

        test(`generates v1 handler for ${method} method`, () => {
          const group = [{
            method,
            urlPattern: '/api/resource',
            entries: [{ response: { status: 200, body: { ok: true } } }],
          }];
          const result = generateMswHandlers(group, 'v1');
          expect(result.handlers).toContain(`rest.${method.toLowerCase()}('/api/resource'`);
        });
      }
    });

    // --- Handler references [0] ---
    describe('handler uses first entry', () => {
      test('v1 handler references [0] of imported data', () => {
        const result = generateMswHandlers(singleGroup, 'v1');
        expect(result.handlers).toContain('[0]');
      });

      test('v2 handler references [0] of imported data', () => {
        const result = generateMswHandlers(singleGroup, 'v2');
        expect(result.handlers).toContain('[0]');
      });
    });
  });
});
