// @flow
/* eslint-disable no-underscore-dangle */
import React from 'react'
import type { Tag } from './StyleSheet'
import StyleSheet, { SC_ATTR, LOCAL_ATTR, clones } from './StyleSheet'
import StyleSheetManager from './StyleSheetManager'
import minify from '../utils/minify'
import getNonce from '../utils/nonce'

class ServerTag implements Tag {
  isLocal: boolean
  isProduction: boolean
  components: { [string]: Object }
  size: number
  names: Array<string>

  constructor(isLocal: boolean) {
    this.isLocal = isLocal
    this.isProduction = process.env.NODE_ENV === 'production'
    this.components = {}
    this.size = 0
    this.names = []
  }

  isFull() {
    return false
  }

  addComponent(componentId: string) {
    if (process.env.NODE_ENV !== 'production' && this.components[componentId]) {
      throw new Error(`Trying to add Component '${componentId}' twice!`)
    }
    this.components[componentId] = { componentId, css: '' }
    this.size += 1
  }

  concatenateCSS() {
    return Object.keys(this.components).reduce(
      (styles, k) => styles + this.components[k].css,
      ''
    )
  }

  inject(componentId: string, css: string, name: ?string) {
    const comp = this.components[componentId]

    if (process.env.NODE_ENV !== 'production' && !comp) {
      throw new Error(
        'Must add a new component before you can inject css into it'
      )
    }
    if (comp.css === '') comp.css = `/* sc-component-id: ${componentId} */\n`

    comp.css += css.replace(/\n*$/, '\n')

    if (name) this.names.push(name)
  }

  toHTML() {
    const attrs: Array<string> = [
      'type="text/css"',
      `${SC_ATTR}="${this.names.join(' ')}"`,
      `${LOCAL_ATTR}="${this.isLocal ? 'true' : 'false'}"`,
    ]
    const nonce = getNonce()
    let outputCSS = this.concatenateCSS()

    if (nonce) {
      attrs.push(`nonce="${nonce}"`)
    }

    if (this.isProduction) {
      outputCSS = minify(outputCSS)
    }

    return `<style ${attrs.join(' ')}>${outputCSS}</style>`
  }

  toReactElement(key: string) {
    const attrs: Object = {
      [SC_ATTR]: this.names.join(' '),
      [LOCAL_ATTR]: this.isLocal.toString(),
    }
    const nonce = getNonce()
    let outputCSS = this.concatenateCSS()

    if (nonce) {
      attrs.nonce = nonce
    }

    if (this.isProduction) {
      outputCSS = minify(outputCSS)
    }

    return (
      <style
        key={key}
        type="text/css"
        {...attrs}
        dangerouslySetInnerHTML={{ __html: outputCSS }}
      />
    )
  }

  clone() {
    const copy = new ServerTag(this.isLocal)
    copy.names = [].concat(this.names)
    copy.size = this.size
    copy.components = Object.keys(this.components).reduce((acc, key) => {
      acc[key] = { ...this.components[key] } // eslint-disable-line no-param-reassign
      return acc
    }, {})

    return copy
  }
}

export default class ServerStyleSheet {
  instance: StyleSheet
  closed: boolean

  constructor() {
    this.instance = StyleSheet.clone(StyleSheet.instance)
  }

  collectStyles(children: any) {
    if (this.closed) {
      throw new Error("Can't collect styles once you've called getStyleTags!")
    }
    return (
      <StyleSheetManager sheet={this.instance}>{children}</StyleSheetManager>
    )
  }

  getStyleTags(): string {
    if (!this.closed) {
      clones.splice(clones.indexOf(this.instance), 1)
      this.closed = true
    }

    return this.instance.toHTML()
  }

  getStyleElement() {
    if (!this.closed) {
      clones.splice(clones.indexOf(this.instance), 1)
      this.closed = true
    }

    return this.instance.toReactElements()
  }

  static create() {
    return new StyleSheet(isLocal => new ServerTag(isLocal))
  }
}
