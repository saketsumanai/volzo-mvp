/**
 * Swagger API Documentation Configuration
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Volzo Mobility API',
      version: '1.0.0',
      description: 'Production-grade API for EV ride-hailing platform',
      contact: {
        name: 'Volzo Mobility',
        email: 'dev@volzo.com'
      }
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}/api/v1`,
        description: 'Development server'
      },
      {
        url: 'https://api.volzo.com/api/v1',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            errors: {
              type: 'array',
              items: {
                type: 'object'
              }
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            phoneNumber: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['RIDER', 'DRIVER', 'ADMIN'] },
            status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'DELETED'] }
          }
        },
        Ride: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            rideNumber: { type: 'string' },
            rideType: { type: 'string', enum: ['SCOOTER', 'RICKSHAW_SHARED', 'RICKSHAW_PRIVATE'] },
            status: { type: 'string' },
            pickupLocation: { type: 'object' },
            dropoffLocation: { type: 'object' },
            estimatedFare: { type: 'number' },
            finalFare: { type: 'number' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js']
};

const specs = swaggerJsdoc(options);

const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Volzo Mobility API Docs'
  }));
};

module.exports = { setupSwagger, specs };
