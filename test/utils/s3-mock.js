'use strict'

const { expect } = require('aegir/utils/chai')
const sinon = require('sinon')
const { Buffer } = require('buffer')
const AWS = require('aws-sdk')

class S3Error extends Error {
  /**
   * @param {string} message
   * @param {number} [code]
   */
  constructor (message, code) {
    super(message)
    this.code = message
    this.statusCode = code
  }
}

/**
 * @template T
 * @param {T} [res]
 */
const s3Resolve = (res) => {
  const request = new AWS.Request(new AWS.Service(), 'op')

  sinon.replace(request, 'promise', () => {
    return Promise.resolve(res)
  })

  return request
}

/**
 * @template T
 * @param {T} err
 */
const s3Reject = (err) => {
  const request = new AWS.Request(new AWS.Service(), 'op')

  sinon.replace(request, 'promise', () => {
    return Promise.reject(err)
  })

  return request
}

/**
 * Mocks out the s3 calls made by datastore-s3
 *
 * @param {import('aws-sdk/clients/s3')} s3
 * @returns {void}
 */
module.exports = function (s3) {
  const mocks = {}
  /** @type {Record<string, any>} */
  const storage = {}

  mocks.deleteObject = sinon.replace(s3, 'deleteObject', (params) => {
    expect(params).to.have.property('Key').that.is.a('string')

    if (!params) {
      throw new Error('No params passed to s3.deleteObject')
    }

    if (typeof params === 'function') {
      throw new Error('params passed to s3.deleteObject was a function')
    }

    if (storage[params.Key]) {
      delete storage[params.Key]
      return s3Resolve({})
    }

    return s3Reject(new S3Error('NotFound', 404))
  })

  mocks.getObject = sinon.replace(s3, 'getObject', (params) => {
    expect(params).to.have.property('Key').that.is.a('string')

    if (!params) {
      throw new Error('No params passed to s3.getObject')
    }

    if (typeof params === 'function') {
      throw new Error('params passed to s3.getObject was a function')
    }

    if (storage[params.Key]) {
      return s3Resolve({ Body: storage[params.Key] })
    }

    return s3Reject(new S3Error('NotFound', 404))
  })

  mocks.headBucket = sinon.replace(s3, 'headBucket', (params) => {
    expect(params).to.have.property('Bucket').that.is.a('string')

    if (!params) {
      throw new Error('No params passed to s3.headBucket')
    }

    if (typeof params === 'function') {
      throw new Error('params passed to s3.headBucket was a function')
    }

    return s3Resolve()
  })

  mocks.headObject = sinon.replace(s3, 'headObject', (params) => {
    expect(params).to.have.property('Key').that.is.a('string')

    if (!params) {
      throw new Error('No params passed to s3.headObject')
    }

    if (typeof params === 'function') {
      throw new Error('params passed to s3.headObject was a function')
    }

    if (storage[params.Key]) {
      return s3Resolve({})
    }
    return s3Reject(new S3Error('NotFound', 404))
  })

  mocks.listObjectV2 = sinon.replace(s3, 'listObjectsV2', (params) => {
    expect(params).to.have.property('Prefix').that.is.a('string')

    if (!params) {
      throw new Error('No params passed to s3.listObjectsV2')
    }

    if (typeof params === 'function') {
      throw new Error('params passed to s3.listObjectsV2 was a function')
    }

    const results = {
      /** @type {({ Key: string })[]} */
      Contents: []
    }

    for (const k in storage) {
      if (k.startsWith(`${params.Prefix || ''}`)) {
        results.Contents.push({
          Key: k
        })
      }
    }

    return s3Resolve(results)
  })

  mocks.upload = sinon.replace(s3, 'upload', (params) => {
    expect(params.Key).to.be.a('string')
    expect(params.Body).to.be.instanceof(Buffer)
    storage[params.Key] = params.Body
    return s3Resolve({})
  })
}

module.exports.S3Error = S3Error
module.exports.s3Resolve = s3Resolve
module.exports.s3Reject = s3Reject
