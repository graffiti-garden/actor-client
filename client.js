export default class ActorClient {

  constructor(origin) {
    this.origin = origin??"https://actor.graffiti.garden"
    // this.origin = origin??"http://localhost:5173"
    this.messageEvents = new EventTarget()
    this.selectEvents = new EventTarget()
    this.initializeEvents = new EventTarget()

    this.initialized = false

    window.onmessage = this.#onIframeMessage.bind(this)

    // Create an iframe...
    this.iframe = document.createElement('iframe')
    this.iframe.src = this.origin

    // ... within a dialog
    this.dialog = document.createElement('dialog')
    this.dialog.className = "graffiti-actor-manager"

    // Click outside of dialog to close
    this.dialog.addEventListener('click', e=>{
      const rect = this.dialog.getBoundingClientRect()
      if (
        rect.top > e.clientY ||
        rect.left > e.clientX ||
        e.clientY > rect.top + rect.height ||
        e.clientX > rect.left + rect.width) {

        // Throw a null event
        const selectEvent = new Event("selected")
        selectEvent.selected = null
        this.selectEvents.dispatchEvent(selectEvent)

        this.dialog.close()
      }
    })
    this.dialog.prepend(this.iframe)
    document.body.prepend(this.dialog)
  }

  async selectActor() {
    // Make the iframe visible
    this.dialog.showModal()

    // Wait for a message
    const selected = await new Promise(resolve => {
      this.selectEvents.addEventListener(
        "selected",
        e=> resolve(e.selected),
        { once: true, passive: true }
      )
    })

    if (!selected) {
      throw "User cancled actor selection."
    }

    // Make the iframe invisible again
    this.dialog.close()

    return selected
  }

  async sign(message, actor) {
    return await this.#sendAndReceive("sign", { message, actor })
  }

  async verify(signed) {
    return await this.#sendAndReceive("verify", signed)
  }

  async #sendAndReceive(action, message) {
    // Make sure the iframe is set up
    if (!this.initialized) {
      await new Promise(resolve => {
        this.initializeEvents.addEventListener(
          "initialized",
          e=> resolve(),
          { once: true, passive: true }
        )
      })
    }

    // Create a random ID for reply
    const messageID = crypto.randomUUID()
    this.iframe.contentWindow.postMessage(
      JSON.parse(JSON.stringify({
        messageID,
        action,
        message
      })),
      this.origin)

    // Wait for a reply via events or throw an error
    const data = await new Promise(resolve => {
      this.messageEvents.addEventListener(
        messageID,
        e=> resolve(e.data),
        { once: true, passive: true }
      )
    })

    if ('reply' in data) {
      return data.reply
    } else {
      throw data.error
    }
  }

  #onIframeMessage({data}) {
    if ('messageID' in data) {
      const messageEvent = new Event(data.messageID)
      messageEvent.data = data
      this.messageEvents.dispatchEvent(messageEvent)
    } else if ('selected' in data) {
      const selectEvent = new Event("selected")
      selectEvent.selected = data.selected
      this.selectEvents.dispatchEvent(selectEvent)
    } else if ('initialized' in data) {
      this.initialized = true
      this.initializeEvents.dispatchEvent(new Event("initialized"))
    }
  }
}