import {Api} from "./core/Api";
import {Route} from "./core/Route";
import {Klaim} from "./core/Klaim";

type Todo = {
    userId: number;
    id: number;
    title: string;
    completed: boolean;
}

// --------- Configuration ---------
Api.create("bonjourLeMonde", "https://jsonplaceholder.typicode.com/", () => {
    Route.get<Todo[]>("todos", "todos");
    Route.get<Todo>("todo", "todos/[id]");
});

// --------- Usage ---------
Klaim.bonjourLeMonde.todo(54)
    .then((response) => {
        console.log(response.title);
    })
