import Joi from 'joi';

export const validateExtension = (data) => {
  const schema = Joi.object({
    number: Joi.string().alphanum().length(4).required(),
    name: Joi.string().required(),
    type: Joi.string().valid('SIP', 'IAX2', 'DAHDI').required(),
    context: Joi.string().default('from-internal'),
    secret: Joi.string(),
    callerid: Joi.string(),
    email: Joi.string().email(),
    department: Joi.string(),
  });

  return schema.validate(data);
};

export const validateSIPTrunk = (data) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    provider: Joi.string(),
    host: Joi.string().hostname().required(),
    port: Joi.number().port().default(5060),
    protocol: Joi.string().valid('SIP', 'UDP', 'TCP', 'TLS').default('SIP'),
    username: Joi.string(),
    secret: Joi.string(),
    ratePerMinute: Joi.number().positive().default(0.05),
  });

  return schema.validate(data);
};

export const validateDialRequest = (data) => {
  const schema = Joi.object({
    from: Joi.string().required(),
    to: Joi.string().required(),
    callType: Joi.string().valid('inbound', 'outbound', 'internal').default('outbound'),
  });

  return schema.validate(data);
};

export const validateQueueCreate = (data) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string(),
    extensionId: Joi.string().uuid().required(),
    strategy: Joi.string()
      .valid('ringall', 'roundrobin', 'leastrecent', 'fewestcalls', 'random', 'rrmemory')
      .default('ringall'),
    maxWaitTime: Joi.number().positive().default(300),
    retryInterval: Joi.number().positive().default(300),
  });

  return schema.validate(data);
};

export const validateQueueTasks = (data) => {
  const schema = Joi.object({
    queueId: Joi.string().uuid().required(),
    phoneNumbers: Joi.array().items(Joi.string().required()).required(),
    maxAttempts: Joi.number().positive().default(3),
  });

  return schema.validate(data);
};

export const validateUserLogin = (data) => {
  const schema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
  });

  return schema.validate(data);
};
