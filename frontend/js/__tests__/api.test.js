/**
 * @jest-environment node
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import fetchMock from 'fetch-mock';

const API_URL = 'https://api.example.com/mantenimientos';
const loadApiModule = () => import('../api.js');

let originalApiUrl;

describe('api.js', () => {
    beforeAll(() => {
        originalApiUrl = process.env.API_URL;
    });

    beforeEach(() => {
        fetchMock.hardReset();
        jest.resetModules();
        process.env.API_URL = API_URL;
        fetchMock.config.Request = typeof Request === 'function' ? Request : fetchMock.config.Request;
        fetchMock.config.Response = typeof Response === 'function' ? Response : fetchMock.config.Response;
        fetchMock.config.Headers = typeof Headers === 'function' ? Headers : fetchMock.config.Headers;
        if (typeof fetch === 'function') {
            fetchMock.config.fetch = fetch;
        }
        fetchMock.mockGlobal();
    });

    afterEach(() => {
        fetchMock.hardReset();
    });

    afterAll(() => {
        fetchMock.hardReset();
        if (originalApiUrl === undefined) {
            delete process.env.API_URL;
        } else {
            process.env.API_URL = originalApiUrl;
        }
    });

    test('guardarMantenimiento envía los datos con acción guardar', async () => {
        const { guardarMantenimiento } = await loadApiModule();
        const payload = { equipo: 'RO', tecnico: 'Ana' };
        const responseData = { id: 'abc123' };

        fetchMock.post(API_URL, { result: 'success', data: responseData });

        const data = await guardarMantenimiento(payload);

        expect(data).toEqual(responseData);
        const lastCall = fetchMock.callHistory.lastCall(API_URL);
        expect(lastCall).toBeDefined();
        expect(lastCall.url).toBe(API_URL);
        expect(lastCall.options.method).toBe('post');
        expect(lastCall.options.headers['content-type']).toBe('text/plain; charset=utf-8');
        expect(JSON.parse(lastCall.options.body)).toEqual({ action: 'guardar', ...payload });
    });

    test('buscarMantenimientos envía la acción buscar', async () => {
        const { buscarMantenimientos } = await loadApiModule();
        const filtros = { cliente: 'ACME' };
        const responseData = [{ id: '1' }];

        fetchMock.post(API_URL, { result: 'success', data: responseData });

        const data = await buscarMantenimientos(filtros);

        expect(data).toEqual(responseData);
        const lastCall = fetchMock.callHistory.lastCall(API_URL);
        expect(lastCall).toBeDefined();
        expect(lastCall.url).toBe(API_URL);
        expect(JSON.parse(lastCall.options.body)).toEqual({ action: 'buscar', ...filtros });
    });

    test('lanza error cuando la API responde con fallo', async () => {
        const { actualizarMantenimiento } = await loadApiModule();
        fetchMock.post(API_URL, { result: 'error', error: 'falló' });

        await expect(actualizarMantenimiento({ id: '1' })).rejects.toThrow('falló');
    });

    test('obtenerDashboard realiza petición GET y devuelve datos', async () => {
        const { obtenerDashboard } = await loadApiModule();
        const dashboardData = { totales: 5 };

        fetchMock.get(`${API_URL}?action=dashboard`, { result: 'success', data: dashboardData });

        const data = await obtenerDashboard();

        expect(data).toEqual(dashboardData);
        const lastCall = fetchMock.callHistory.lastCall(`${API_URL}?action=dashboard`);
        expect(lastCall).toBeDefined();
        expect(lastCall.url).toBe(`${API_URL}?action=dashboard`);
        expect(lastCall.options.method).toBe('get');
    });

    test('lanza error cuando API_URL no está configurada', async () => {
        fetchMock.hardReset();
        jest.resetModules();
        delete process.env.API_URL;
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const { guardarMantenimiento } = await loadApiModule();

        await expect(guardarMantenimiento({})).rejects.toThrow('API_URL no está configurada.');

        warnSpy.mockRestore();
    });
});
