import toCamelCase from "../tools/toCamelCase";

import { Element, ICallback, ICallbackAfterArgs, ICallbackBeforeArgs, ICallbackCallArgs,IHeaders } from "./Element";
import { Registry } from "./Registry";

type GroupCallback = () => void;

export class Group extends Element {
    public static create (name: string, callback: GroupCallback): Element {
        const camelCasedName = toCamelCase(name);

        // Get current parent to build full path
        const currentParent = Registry.i.getCurrentParent();
        const parentPath = currentParent ? Registry.i.getFullPath(currentParent) : "";
        const fullName = parentPath ? `${parentPath}.${camelCasedName}` : camelCasedName;

        // Create the group with the camelCased name
        const group = new Group(camelCasedName, "");

        if (camelCasedName !== name) {
            console.warn(`Group name "${name}" has been camelCased to "${camelCasedName}"`);
        }

        // Register the group with camelCased name
        Registry.i.registerElement(group);

        // Save current parent state
        const previousParent = Registry.i.getCurrentParent();

        // Set this group as the current parent using full path with camelCased name
        Registry.i.setCurrentParent(fullName);

        // Execute the callback
        callback();

        // Restore the previous parent or clear if none
        if (previousParent) {
            Registry.i.setCurrentParent(Registry.i.getFullPath(previousParent));
        } else {
            Registry.i.clearCurrentParent();
        }

        return group;
    }

    private constructor (name: string, url: string, headers: IHeaders = {}) {
        super("group", name, url, headers);
    }

    // Overriding parent methods to ensure group-specific behavior
    public withCache (duration = 20): this {
        super.withCache(duration);
        // Propagate cache settings to existing children
        Registry.i.getChildren(Registry.i.getFullPath(this))
            .forEach(child => {
                if (!child.cache) {
                    child.cache = duration;
                }
            });
        return this;
    }

    public withRetry (maxRetries = 2): this {
        super.withRetry(maxRetries);
        // Propagate retry settings to existing children
        Registry.i.getChildren(Registry.i.getFullPath(this))
            .forEach(child => {
                if (!child.retry) {
                    child.retry = maxRetries;
                }
            });
        return this;
    }

    public before (callback: ICallback<ICallbackBeforeArgs>): this {
        super.before(callback);
        // Propagate before callback to existing children
        Registry.i.getChildren(Registry.i.getFullPath(this))
            .forEach(child => {
                if (!child.callbacks.before) {
                    child.callbacks.before = callback;
                }
            });
        return this;
    }

    public after (callback: ICallback<ICallbackAfterArgs>): this {
        super.after(callback);
        // Propagate after callback to existing children
        Registry.i.getChildren(Registry.i.getFullPath(this))
            .forEach(child => {
                if (!child.callbacks.after) {
                    child.callbacks.after = callback;
                }
            });
        return this;
    }

    public onCall (callback: ICallback<ICallbackCallArgs>): this {
        super.onCall(callback);
        // Propagate onCall callback to existing children
        Registry.i.getChildren(Registry.i.getFullPath(this))
            .forEach(child => {
                if (!child.callbacks.call) {
                    child.callbacks.call = callback;
                }
            });
        return this;
    }
}
