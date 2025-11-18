const { Cola, Historial } = require("../../lib/utils/estructuras");
const { dispatcher, agentes } = require("./assistants/Dispatcher");

// class Orquestador {
//   static instance = null;
//   orquestador;

//   constructor() {}

//   async execute(message, queue = [], updates = []) {
//     let cola = new Cola(...queue);
//     let historial = new Historial(...updates);

//     if (message) historial.update({ role: "user", text: message });

//     if (cola.isEmpty()) {
//       this.orquestador = ASSISTANTS_MAP["orquestador"];
//     } else {
//       this.orquestador = ASSISTANTS_MAP[cola.seeNext().assistant];
//     }
//     let response;

//     console.log(cola);

// if (cola.seeNext().functionCall) {
//   const task = cola.pop();
//   response = await this.orquestador.call(
//     task.functionCall.args,
//     historial,
//     cola
//   );
// } else {
//   response = await this.orquestador.execute(message);
// }
// console.log(response);

//     let parts = response.map((part) => ({
//       role: "assistant",
//       assistant: this.name,
//       ...("functionCall" in part
//         ? {
//             functionCall: new Task({
//               tarea: part.functionCall.name,
//               args: part.functionCall.args,
//               assistant: this.name,
//             }),
//           }
//         : part),
//     }));

//     cola.push(...parts);
//     historial.update(...parts);

//     return { cola: cola.getClean(), historial: historial.getClean() };
//   }
// }

async function orchestrate(message, history = [], stack = []) {
  const activeAgent = agentes["orquestador"]; // el agente principal
  const responses = await activeAgent.execute(message);

  const messages = [];
  const newTasks = [];

  for (const part of responses) {
    if (part.functionCall) {
      newTasks.push(part.functionCall);
    } else {
      messages.push({
        role: "assistant",
        text: part.message,
        assistant: part.assistant,
      });
    }
  }

  return { messages, tasks: [...stack, ...newTasks] };
}

async function processTask(task, history, stack) {
  const result = await dispatcher(
    task.assistant.toLowerCase(),
    task.args,
    history,
    stack
  );

  // resultado del agente (por ejemplo: vuelos encontrados)
  const messages = result.map((r) => ({
    role: "assistant",
    text: r.message,
    data: r.data || null,
    assistant: r.assistant,
  }));

  return { messages, taskResult: { ...task, status: "completed" } };
}

async function handleChat(req, res) {
  try {
    //HAGAMOS ALGO, ESTE ES EL PUNTO DE ENTRADA, EN ESTA PARTE LO QUE VA A PASAR ES ESTO:
    /**
     * 1. RECIBIMOS EL MENSAJE, EL HISTORIAL Y LA PILA DE TAREAS
     * 2. SI HAY UNA TAREA EN LA PILA, LA PROCESAMOS, MANDAMOS A LLAMAR UNA FUNCIÓN QUE SE ENCARGUE DE ESO Y DENTRO DEBERA ESCOGER EL ASISTENTE CORRECTO Y ASI
     * 4. SI NO HAY TAREAS, LLAMAMOS AL ASISTENTE, USANDO UNA FUNCIÓN QUE SE ENCARGUE DE ESO Y DENTRO DEBERA ESCOGER EL ASISTENTE CORRECTO Y ASI
     * 5. DEVOLVEMOS LAS RESPUESTAS Y EL RESULTADO DE LA TAREA (SI HUBO ALGUNA)
     */
    const { message, history = [], stack = [] } = req.body;
    let asistente = new Orquestador();

    if (!!stack.seeNext().functionCall) {
      const { messages, taskResult } = await processTask(task, history, stack);
    } else {
      const { messages, tasks } = await orchestrate(message, history, stack);
    }

    res.json({
      history: [...history, ...messages],
      stack: tasks || stack,
      taskResult,
    });
  } catch (error) {
    console.error("Error processing chat:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = { handleChat };
