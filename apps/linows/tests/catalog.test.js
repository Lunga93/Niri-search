import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    isSyntheticResultId,
    isPrefixedQuery,
    isCommandSuggestionQuery,
    prefixSuggestionResults,
    commandSuggestionResults,
    webSuggestionResults,
    webUrlResult,
    placeUrlRow,
    calcResult,
    classifyResultId,
    prefixFromResultId,
    commandIdFromResultId,
    webSuggestionFromResultId,
    webUrlFromResultId,
    calcRawFromResultId,
} from '../src/js/catalog.js';

// Guards the Ctrl+Shift+H hide-app path: every synthetic kind:'app' row must be
// rejected so its display text never lands in app_exclude_names.
test('isSyntheticResultId flags every synthetic row id', () => {
    const synthetic = [
        ...prefixSuggestionResults(''),
        ...commandSuggestionResults(':'),
        ...webSuggestionResults(['weather today']),
        webUrlResult('https://example.com', 'Open in browser', 1),
    ];
    for (const row of synthetic) {
        assert.equal(row.kind, 'app', `${row.id} should be a kind:'app' row`);
        assert.equal(isSyntheticResultId(row.id), true, `${row.id} should be synthetic`);
    }
});

test('isSyntheticResultId passes real apps and bad input', () => {
    assert.equal(isSyntheticResultId('app:/usr/share/applications/firefox.desktop'), false);
    assert.equal(isSyntheticResultId(null), false);
    assert.equal(isSyntheticResultId(undefined), false);
    assert.equal(isSyntheticResultId(''), false);
});

// isPrefixedQuery tests
test('isPrefixedQuery detects prefix-driven modes', () => {
    // Discovery menu
    assert.equal(isPrefixedQuery('"'), true);
    assert.equal(isPrefixedQuery('"folder'), true);
    
    // Command menu
    assert.equal(isPrefixedQuery(':'), true);
    assert.equal(isPrefixedQuery(':calc'), true);
    assert.equal(isPrefixedQuery(':calc 123'), true);
    
    // PREFIX_ENTRIES
    assert.equal(isPrefixedQuery('a"'), true);
    assert.equal(isPrefixedQuery('a"firefox'), true);
    assert.equal(isPrefixedQuery('f"'), true);
    assert.equal(isPrefixedQuery('f"document'), true);
    assert.equal(isPrefixedQuery('d"'), true);
    assert.equal(isPrefixedQuery('d"projects'), true);
    assert.equal(isPrefixedQuery('rc"'), true);
    assert.equal(isPrefixedQuery('rc"folder'), true);
    assert.equal(isPrefixedQuery('r"'), true);
    assert.equal(isPrefixedQuery('r"pattern'), true);
    assert.equal(isPrefixedQuery('ps"'), true);
    assert.equal(isPrefixedQuery('ps"chrome'), true);
    assert.equal(isPrefixedQuery('c"'), true);
    assert.equal(isPrefixedQuery('c"text'), true);
    assert.equal(isPrefixedQuery('t"'), true);
    assert.equal(isPrefixedQuery('t"hello'), true);
});

test('isPrefixedQuery rejects non-prefixed queries', () => {
    assert.equal(isPrefixedQuery(''), false);
    assert.equal(isPrefixedQuery('hello'), false);
    assert.equal(isPrefixedQuery('firefox'), false);
    assert.equal(isPrefixedQuery('a'), false);  // incomplete prefix
    assert.equal(isPrefixedQuery('abc'), false);
    assert.equal(isPrefixedQuery(null), false);
    assert.equal(isPrefixedQuery(undefined), false);
});

// isCommandSuggestionQuery tests
test('isCommandSuggestionQuery detects command menu queries', () => {
    assert.equal(isCommandSuggestionQuery(':'), true);
    assert.equal(isCommandSuggestionQuery(':calc'), true);
    assert.equal(isCommandSuggestionQuery(':kill'), true);
    assert.equal(isCommandSuggestionQuery(':unknown'), true);
    assert.equal(isCommandSuggestionQuery(':calc '), false);  // inline command with args
    assert.equal(isCommandSuggestionQuery(':calc 123'), false);  // inline command with args
});

// prefixSuggestionResults tests
test('prefixSuggestionResults returns all prefixes when no filter', () => {
    const results = prefixSuggestionResults('"');
    assert.equal(results.length, 8);  // 8 PREFIX_ENTRIES
    assert.equal(results[0].id, 'prefixhint:a"');
    assert.equal(results[0].title, 'a"word');
    assert.equal(results[0].subtitle, 'Apps only');
    assert.equal(results[0].kind, 'app');
});

test('prefixSuggestionResults filters by prefix', () => {
    // "a" matches multiple entries containing 'a' in prefix, prefix+argHint, or description
    const results = prefixSuggestionResults('"a');
    assert.equal(results.length, 5);  // a", rc", c", t", ps" all contain 'a'
    assert.equal(results[0].id, 'prefixhint:a"');
});

test('prefixSuggestionResults filters by description', () => {
    // "folder" matches entries with "folder" in description
    const results = prefixSuggestionResults('"folder');
    assert.equal(results.length, 2);  // d" (Folders only) and rc" (files/folders)
    assert.equal(results[0].id, 'prefixhint:d"');
    assert.equal(results[0].subtitle, 'Folders only');
    assert.equal(results[1].id, 'prefixhint:rc"');
    assert.equal(results[1].subtitle, 'Recent files/folders, newest first (optional filter)');
});

test('prefixSuggestionResults filters case-insensitive', () => {
    const results = prefixSuggestionResults('"FOLDER');
    assert.equal(results.length, 2);  // same as above, case-insensitive
    assert.equal(results[0].id, 'prefixhint:d"');
    assert.equal(results[1].id, 'prefixhint:rc"');
});

// commandSuggestionResults tests
test('commandSuggestionResults returns all commands when no filter', () => {
    const results = commandSuggestionResults(':');
    assert.equal(results.length, 7);  // 7 COMMAND_DEFINITIONS
    assert.equal(results[0].id, 'cmdhint:calc');
    assert.equal(results[0].title, 'calc (Ctrl+1)');
    assert.equal(results[0].subtitle, 'Evaluate math expression');
    assert.equal(results[0].kind, 'app');
});

test('commandSuggestionResults filters by id', () => {
    const results = commandSuggestionResults(':calc');
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'cmdhint:calc');
});

test('commandSuggestionResults filters by detail', () => {
    const results = commandSuggestionResults(':math');
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'cmdhint:calc');
});

test('commandSuggestionResults filters case-insensitive', () => {
    const results = commandSuggestionResults(':CALC');
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'cmdhint:calc');
});

// webSuggestionResults tests
test('webSuggestionResults creates rows with negative scores', () => {
    const results = webSuggestionResults(['weather', 'news']);
    assert.equal(results.length, 2);
    assert.equal(results[0].id, 'websuggest:weather');
    assert.equal(results[0].score, -1);
    assert.equal(results[1].id, 'websuggest:news');
    assert.equal(results[1].score, -2);
    assert.equal(results[0].kind, 'app');
    assert.equal(results[0].subtitle, 'Search Google');
});

test('webSuggestionResults handles empty suggestions', () => {
    const results = webSuggestionResults([]);
    assert.equal(results.length, 0);
});

// webUrlResult tests
test('webUrlResult creates URL rows with correct structure', () => {
    const result = webUrlResult('https://example.com', 'Open in browser', 10);
    assert.equal(result.id, 'weburl:https://example.com');
    assert.equal(result.title, 'https://example.com');
    assert.equal(result.subtitle, 'Open in browser');
    assert.equal(result.path, 'https://example.com');
    assert.equal(result.score, 10);
    assert.equal(result.kind, 'app');
});

// placeUrlRow tests
test('placeUrlRow puts structural URL first', () => {
    const ranked = [{ id: 'app1' }, { id: 'app2' }];
    const url = { id: 'weburl:https://example.com' };
    const result = placeUrlRow(url, false, ranked);
    assert.equal(result.length, 3);
    assert.equal(result[0].id, 'weburl:https://example.com');
    assert.equal(result[1].id, 'app1');
    assert.equal(result[2].id, 'app2');
});

test('placeUrlRow puts bare host URL after first ranked item', () => {
    const ranked = [{ id: 'app1' }, { id: 'app2' }];
    const url = { id: 'weburl:https://example.com' };
    const result = placeUrlRow(url, true, ranked);
    assert.equal(result.length, 3);
    assert.equal(result[0].id, 'app1');
    assert.equal(result[1].id, 'weburl:https://example.com');
    assert.equal(result[2].id, 'app2');
});

test('placeUrlRow handles empty ranked list', () => {
    const ranked = [];
    const url = { id: 'weburl:https://example.com' };
    const result = placeUrlRow(url, true, ranked);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'weburl:https://example.com');
});

// calcResult tests
test('calcResult creates calculator rows with max score', () => {
    const result = calcResult('2+2', { raw: '2+2', display: '4' });
    assert.equal(result.id, 'calc:2+2');
    assert.equal(result.title, '4');
    assert.equal(result.subtitle, '2+2  •  Enter to copy');
    assert.equal(result.path, '2+2');
    assert.equal(result.score, Number.MAX_SAFE_INTEGER);
    assert.equal(result.kind, 'app');
    assert.equal(result.calcExpr, '2+2');
});

// classifyResultId tests
test('classifyResultId identifies prefix suggestions', () => {
    const result = classifyResultId('prefixhint:a"');
    assert.deepEqual(result, { kind: 'prefixSuggestion', prefix: 'a"' });
});

test('classifyResultId identifies command suggestions', () => {
    const result = classifyResultId('cmdhint:calc');
    assert.deepEqual(result, { kind: 'commandSuggestion', commandId: 'calc' });
});

test('classifyResultId identifies calculator results', () => {
    const result = classifyResultId('calc:2+2');
    assert.deepEqual(result, { kind: 'calc', raw: '2+2' });
});

test('classifyResultId identifies web suggestions', () => {
    const result = classifyResultId('websuggest:weather');
    assert.deepEqual(result, { kind: 'webSuggestion', text: 'weather' });
});

test('classifyResultId identifies web URLs', () => {
    const result = classifyResultId('weburl:https://example.com');
    assert.deepEqual(result, { kind: 'webUrl', url: 'https://example.com' });
});

test('classifyResultId returns null for real candidates', () => {
    const result = classifyResultId('app:/usr/share/applications/firefox.desktop');
    assert.equal(result, null);
});

test('classifyResultId handles null/undefined/empty', () => {
    assert.equal(classifyResultId(null), null);
    assert.equal(classifyResultId(undefined), null);
    assert.equal(classifyResultId(''), null);
});

// Individual FromResultId functions
test('prefixFromResultId extracts prefix', () => {
    assert.equal(prefixFromResultId('prefixhint:a"'), 'a"');
    assert.equal(prefixFromResultId('prefixhint:rc"'), 'rc"');
    assert.equal(prefixFromResultId('prefixhint:'), '');
    assert.equal(prefixFromResultId('cmdhint:calc'), null);
    assert.equal(prefixFromResultId(null), null);
    assert.equal(prefixFromResultId(undefined), null);
    assert.equal(prefixFromResultId(''), null);
});

test('commandIdFromResultId extracts command id', () => {
    assert.equal(commandIdFromResultId('cmdhint:calc'), 'calc');
    assert.equal(commandIdFromResultId('cmdhint:kill'), 'kill');
    assert.equal(commandIdFromResultId('cmdhint:'), '');
    assert.equal(commandIdFromResultId('prefixhint:a"'), null);
    assert.equal(commandIdFromResultId(null), null);
    assert.equal(commandIdFromResultId(undefined), null);
    assert.equal(commandIdFromResultId(''), null);
});

test('webSuggestionFromResultId extracts suggestion text', () => {
    assert.equal(webSuggestionFromResultId('websuggest:weather'), 'weather');
    assert.equal(webSuggestionFromResultId('websuggest:'), '');
    assert.equal(webSuggestionFromResultId('prefixhint:a"'), null);
    assert.equal(webSuggestionFromResultId(null), null);
    assert.equal(webSuggestionFromResultId(undefined), null);
    assert.equal(webSuggestionFromResultId(''), null);
});

test('webUrlFromResultId extracts URL', () => {
    assert.equal(webUrlFromResultId('weburl:https://example.com'), 'https://example.com');
    assert.equal(webUrlFromResultId('weburl:'), '');
    assert.equal(webUrlFromResultId('prefixhint:a"'), null);
    assert.equal(webUrlFromResultId(null), null);
    assert.equal(webUrlFromResultId(undefined), null);
    assert.equal(webUrlFromResultId(''), null);
});

test('calcRawFromResultId extracts raw calculation', () => {
    assert.equal(calcRawFromResultId('calc:2+2'), '2+2');
    assert.equal(calcRawFromResultId('calc:'), '');
    assert.equal(calcRawFromResultId('prefixhint:a"'), null);
    assert.equal(calcRawFromResultId(null), null);
    assert.equal(calcRawFromResultId(undefined), null);
    assert.equal(calcRawFromResultId(''), null);
});
