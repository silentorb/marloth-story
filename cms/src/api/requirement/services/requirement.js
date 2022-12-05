'use strict';

/**
 * requirement service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::requirement.requirement');
