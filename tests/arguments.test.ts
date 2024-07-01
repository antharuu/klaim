import {describe, expect, it, vi} from 'vitest';
import {Route, RouteArgumentType} from '../src/core/Route';

// Mocks
vi.mock('../tools/token', () => ({
    default: vi.fn(() => 'mocked-token'),
}));

vi.mock('../tools/slugify', () => ({
    default: vi.fn((str: string) => str.replace(/\s+/g, '-').toLowerCase()),
}));

describe('Route.detectArgumentsOfUrl', () => {
    it('should detect arguments of type ANY', () => {
        const route = new Route('/user/[id]');
        const args = route._arguments;

        expect(args.size).toBe(1);
        expect(Array.from(args)).toEqual([
            {name: 'id', type: RouteArgumentType.ANY, default: null, required: true},
        ]);
    });

    it('should detect multiple arguments', () => {
        const route = new Route('/posts/[post]/comments/[comment]');
        const args = route._arguments;

        expect(args.size).toBe(2);
        expect(Array.from(args)).toEqual([
            {name: 'post', type: RouteArgumentType.ANY, default: null, required: true},
            {name: 'comment', type: RouteArgumentType.ANY, default: null, required: true},
        ]);
    });

    it('should detect arguments with specific types', () => {
        const route = new Route('/user/[id:number]');
        const args = route._arguments;

        expect(args.size).toBe(1);
        expect(Array.from(args)).toEqual([
            {name: 'id', type: RouteArgumentType.NUMBER, default: null, required: true},
        ]);
    });

    it('should detect arguments with default values', () => {
        const route = new Route('/user/[id:number=1]');
        const args = route._arguments;

        expect(args.size).toBe(1);
        expect(Array.from(args)).toEqual([
            {name: 'id', type: RouteArgumentType.NUMBER, default: 1, required: true},
        ]);
    });

    it('should detect optional arguments', () => {
        const route = new Route('/user/[name?]');
        const args = route._arguments;

        expect(args.size).toBe(1);
        expect(Array.from(args)).toEqual([
            {name: 'name', type: RouteArgumentType.ANY, default: null, required: false},
        ]);
    });

    it('should detect multiple arguments with different types', () => {
        const route = new Route('/profile/[user:string]/settings/[setting:boolean]');
        const args = route._arguments;

        expect(args.size).toBe(2);
        expect(Array.from(args)).toEqual([
            {name: 'user', type: RouteArgumentType.STRING, default: null, required: true},
            {name: 'setting', type: RouteArgumentType.BOOLEAN, default: null, required: true},
        ]);
    });

    it('should handle invalid JSON in default value gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        });
        const route = new Route('/user/[id:number=invalid]');
        const args = route._arguments;

        expect(args.size).toBe(1);
        expect(Array.from(args)).toEqual([
            {name: 'id', type: RouteArgumentType.NUMBER, default: 'invalid', required: true},
        ]);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
