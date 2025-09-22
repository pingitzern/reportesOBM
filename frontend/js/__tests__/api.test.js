/**
 * @jest-environment node
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import fetchMock from 'fetch-mock';

const API_URL = 'https://api.example.com/mantenimientos';
const loadApiModule = async ({ token = 'token-123' } = {}) => {
    const getCurrentTokenMock = jest.fn(() => token);
    const handleSessionExpirationMock = jest.fn();

    jest.unstable_mockModule('../auth.js', () => ({
        getCurrentToken: getCurrentTokenMock,
        handleSessionExpiration: handleSessionExpirationMock,
    }));

    const module = await import('../api.js');
    return {
        ...module,
        __authMocks: {
            getCurrentTokenMock,
            handleSessionExpirationMock,
        },
    };
};
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
        const { guardarMantenimiento, __authMocks } = await loadApiModule();
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
        expect(JSON.parse(lastCall.options.body)).toEqual({
            action: 'guardar',
            ...payload,
            token: 'token-123',
        });
        expect(__authMocks.getCurrentTokenMock).toHaveBeenCalledTimes(1);
        expect(__authMocks.handleSessionExpirationMock).not.toHaveBeenCalled();
    });

    test('no realiza petición cuando no hay token disponible', async () => {
        const { guardarMantenimiento, __authMocks } = await loadApiModule({ token: null });

        await expect(guardarMantenimiento({ equipo: 'RO' }))
            .rejects.toThrow('No hay una sesión activa. Por favor, ingresá de nuevo.');
        expect(fetchMock.callHistory.calls(API_URL).length).toBe(0);
        expect(__authMocks.getCurrentTokenMock).toHaveBeenCalledTimes(1);
        expect(__authMocks.handleSessionExpirationMock).not.toHaveBeenCalled();
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
        expect(JSON.parse(lastCall.options.body)).toEqual({
            action: 'buscar',
            ...filtros,
            token: 'token-123',
        });
    });

    test.each([
        ['Sesión expirada', { result: 'error', error: 'Sesión expirada' }],
        ['Token inválido', { result: 'error', message: 'Token inválido' }],
    ])('invoca el manejador de expiración cuando la API devuelve %s', async (_descripcion, respuesta) => {
        const { obtenerDashboard, __authMocks } = await loadApiModule();

        fetchMock.post(API_URL, respuesta);

        await expect(obtenerDashboard()).rejects.toThrow('Tu sesión ha expirado. Por favor, ingresá de nuevo.');
        expect(__authMocks.handleSessionExpirationMock).toHaveBeenCalledTimes(1);
        expect(__authMocks.getCurrentTokenMock).toHaveBeenCalledTimes(1);
    });

    test('lanza error cuando la API responde con fallo', async () => {
        const { actualizarMantenimiento } = await loadApiModule();
        fetchMock.post(API_URL, { result: 'error', error: 'falló' });

        await expect(actualizarMantenimiento({ id: '1' })).rejects.toThrow('falló');
    });

    test('obtenerDashboard realiza petición GET y devuelve datos', async () => {
        const { obtenerDashboard } = await loadApiModule();
        const dashboardData = { totales: 5 };

        fetchMock.post(API_URL, { result: 'success', data: dashboardData });

        const data = await obtenerDashboard();

        expect(data).toEqual(dashboardData);
        const lastCall = fetchMock.callHistory.lastCall(API_URL);
        expect(lastCall).toBeDefined();
        expect(lastCall.url).toBe(API_URL);
        expect(lastCall.options.method).toBe('post');
        expect(JSON.parse(lastCall.options.body)).toEqual({
            action: 'dashboard',
            token: 'token-123',
        });
    });

    test('obtenerClientes cachea la respuesta', async () => {
        const { obtenerClientes } = await loadApiModule();
        const clientes = [{ id: '1', nombre: 'ACME' }];

        fetchMock.post(API_URL, { result: 'success', data: clientes });

        const primeraRespuesta = await obtenerClientes();
        expect(primeraRespuesta).toEqual(clientes);
        expect(fetchMock.callHistory.calls(API_URL).length).toBe(1);
        const primeraLlamada = fetchMock.callHistory.lastCall(API_URL);
        expect(primeraLlamada).toBeDefined();
        expect(JSON.parse(primeraLlamada.options.body)).toEqual({
            action: 'clientes',
            token: 'token-123',
        });

        const segundaRespuesta = await obtenerClientes();
        expect(segundaRespuesta).toBe(primeraRespuesta);
        expect(fetchMock.callHistory.calls(API_URL).length).toBe(1);
    });

    test('obtenerClientes fuerza una nueva petición con forceRefresh', async () => {
        const { obtenerClientes } = await loadApiModule();
        const primera = [{ id: '1' }];
        const refresco = [{ id: '2' }];

        fetchMock.post(API_URL, { result: 'success', data: primera }, { repeat: 1 });

        await obtenerClientes();
        expect(fetchMock.callHistory.calls(API_URL).length).toBe(1);

        fetchMock.post(API_URL, { result: 'success', data: refresco }, { overwriteRoutes: true });

        const resultadoRefrescado = await obtenerClientes({ forceRefresh: true });
        expect(fetchMock.callHistory.calls(API_URL).length).toBe(2);
        expect(resultadoRefrescado).toEqual(refresco);
        const ultimaLlamada = fetchMock.callHistory.lastCall(API_URL);
        expect(JSON.parse(ultimaLlamada.options.body)).toEqual({
            action: 'clientes',
            token: 'token-123',
        });
    });

    test('lanza error cuando API_URL no está configurada', async () => {
        fetchMock.hardReset();
        jest.resetModules();
        delete process.env.API_URL;
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const { guardarMantenimiento, __authMocks } = await loadApiModule();

        await expect(guardarMantenimiento({})).rejects.toThrow('API_URL no está configurada.');
        expect(__authMocks.getCurrentTokenMock).not.toHaveBeenCalled();

        warnSpy.mockRestore();
    });
});
