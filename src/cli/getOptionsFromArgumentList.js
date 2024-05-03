const argHandlerRecord = {
  "--data/--get/-g": (options) => options.data = true,
  "--debug/-d": (options) => options.debug = true,
  "--stop/--shutdown/--exit": (options) => options.shutdown = true,
  "--restart/--reload": (options) => options.restart = true,
  "--standalone": (options, action) => options.standalone = action,
  "--logs/--watch/-l": (options) => options.logs = true,
  "--single/--load": (options) => options.single = true,
}

/**
 * @param {string[]} argv 
 */
function getOptionsFromArgumentList(argv) {
  const options = {
    debug: false,
    shutdown: false,
    restart: false,
    standalone: '',
    logs: false,
    single: false,
  };
  const errorList = [];
  for (let i = 2; i < argv.length; i++) {
    const argument = argv[i];
    try {
      let handler;
      let params = [];
      for (const key in argHandlerRecord) {
        const aliases = key.split('/');
        if (!aliases.includes(argument)) {
          continue;
        }
        handler = argHandlerRecord[key];
        const paramsNeeded = handler.length - 1;
        for (let j = 0; j < paramsNeeded; j++) {
          params.push(argv[i + j + 1]);
        }
        break;
      }
      if (!handler) {
        throw new Error('Unhandled parameter');
      }
      try {
        handler(options, ...params);
      } catch (err) {
        errorList.push({
          stage: 'handler',
          params,
          source: 30,
          arg: argument,
          error: err
        })
      }
      if (params.length > 0) {
        i += params.length;
      }
    } catch (err) {
      errorList.push({
        source: 34,
        arg: argument,
        error: err
      })
    }
  }
  const err = errorList.slice(0, 1).map(a => `${a.error.message} ${JSON.stringify(a.arg)}`).join(', ');
  if (errorList.length) {
    throw new Error(err + (errorList.length === 1 ? '' : ` and ${errorList.length} others`));
  }
  return options;
}

export default getOptionsFromArgumentList;