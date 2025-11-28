const { Cola, Historial } = require("../../lib/utils/estructuras");
const { dispatcher, executer } = require("./assistants/Dispatcher");

async function processExecute(
  message,
  history = [],
  stack = []
  // guardar_respuesta = false
) {
  //Este procesa la ejecución normal del asistente, recibe un asistente y debemos manejar tambien cuando la ejecucion falla poder borrar como si no hubiera sido el pop y que se guarde en la base de datos por si se quiere volver a iniciar el chat
  //Debemos manejar cuando la pila este vacia
  const next = stack.pop();
  try {
    const newTasks = [];
    const messages = [];
    // console.log("Processing execute 🖥️:\n", next);
    const parts = await executer(
      message ? "orquestador" : next?.assistant.toLowerCase(),
      message ? message : next?.assistantCall?.instruction,
      history
    );

    // if (guardar_respuesta) console.log(parts);
    // console.log("parts:", parts);

    for (const part of parts) {
      if (part.functionCall) {
        newTasks.push(part);
      } else {
        messages.push(part);
      }
    }

    history.update(...parts);
    stack.push(...newTasks);
  } catch (error) {
    //Aqui deberiamos regresar la tarea del pop si es que hubo tarea del pop, si no hubo entonces no hacemos nada
    // console.log("Error processing execute 🖥️:\n", next, "\n\n", error);
  }
}

async function processTask(history, stack) {
  //Este procesa la tarea, recibe un asistente y debemos manejar tambien cuando la tarea falla poder mandar al task el error y el status failed, si pasa entonces deberemos colocar la solución y el status completed, nosotros nos encargamos de eso
  const task = stack.pop();
  const { functionCall, args, assistant } = task;
  const { id } = functionCall;
  try {
    const response = await dispatcher(
      assistant.toLowerCase(),
      task,
      history,
      stack
    );

    history.map((part) =>
      "functionCall" in part && part.functionCall.id == id
        ? {
            ...part,
            functionCall: {
              ...part.functionCall,
              status: "success",
              resolucion: response,
            },
          }
        : part
    );
  } catch (error) {
    //Aqui deberiamos regresar la tarea del pop si es que hubo tarea del pop, si no hubo entonces no hacemos nada
    history.map((part) =>
      "functionCall" in part && part.functionCall.id == id
        ? {
            ...part,
            functionCall: {
              ...part.functionCall,
              status: "error",
              error: error.message,
            },
          }
        : part
    );
    // console.log("Error processing task 🖥️:\n", task, "\n\n", error);
  }
}

async function handleChat(req, res) {
  const { message } = req.body;
  const stack = new Cola(...(req.body.stack || []));
  const history = new Historial(...(req.body.history || []));

  try {
    if (stack.isEmpty() && !message) {
      throw new Error("No hay mensaje ni tareas para procesar");
    }

    if (message) history.update({ role: "user", text: message });

    if (!!stack.seeNext()?.functionCall) {
      //console.log("Processing task from stack 🖥️:", stack.seeNext());
      await processTask(history, stack);
    } else {
      //console.log("Processing execute 🖥️:", stack.seeNext());
      await processExecute(
        message,
        history,
        stack,
        !!stack.seeNext()?.assistantCall
      );
    }

    while (
      !!stack.seeNext()?.functionCall?.tarea == "conectar_a_asistente" ||
      !!stack.seeNext()?.assistantCall
    ) {
      if (!!stack.seeNext()?.functionCall?.tarea == "conectar_a_asistente") {
        //console.log("Processing task from stack en ciclo 🖥️:", stack.seeNext());
        await processTask(history, stack);
      } else {
        // console.log("Processing execute desde ciclo 🖥️:", stack.seeNext());
        await processExecute(null, history, stack);
      }
    }

    res.status(200).json({
      message: "",
      data: {
        history: history.getClean(),
        stack: stack.getClean(),
      },
    });
  } catch (error) {
    console.error("Error processing chat 🖥️:", error);
    res.status(500).json({
      error: error,
      message: error.message || "Internal Server Error",
      data: {
        history: history.getClean(),
        stack: stack.getClean(),
      },
    });
  }
}

module.exports = { handleChat, processExecute };
