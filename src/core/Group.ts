// Group.ts
import { Element, IHeaders } from "./Element";
import { Registry } from "./Registry";

type GroupCallback = () => void;

export class Group extends Element {
    public static create (name: string, callback: GroupCallback): Element {
        const group = new Group(name, "");
        // Register the group with the current parent
        Registry.i.registerElement(group);

        // Save current parent
        const previousParent = Registry.i.getCurrentParent();

        // Set the group as the new parent
        Registry.i.setCurrentParent(Registry.i.getFullPath(group));

        // Execute the callback
        callback();

        // Restore the previous parent
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
}
