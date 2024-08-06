document.addEventListener("load", () => {
  // Get elements
  const plinko = document.getElementById("plinko")
  const canvas = plinko.querySelector("canvas")
  const startButtons = [...plinko.querySelectorAll(".start-btn")]

  // Define game state
  const gameWidth = 100
  const columns = startButtons.length
  const columnWidth = gameWidth / columns
  const ballRadius = columnWidth * 0.8
  const pegRadius = columnWidth * 0.1
  const marginTop = ballRadius
  let gameState = "ready" // ready / playing / done
  let ballPos = { x: -2 * ballRadius, y: 0 }
  let gameYOffset = -marginTop - ballRadius

  // Create 2D context
  const ctx = canvas.getContext("2d")

  // Define render call
  const render = () => {
    const scale = gameWidth / canvas.width
    const gameHeight = scale * canvas.height
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Scaled rectangle
    ctx.scale(1 / scale, 1 / scale)

    // render ball
    ctx.fillStyle = plinko.style.getPropertyValue("--ball-color")
    ctx.beginPath()
    ctx.ellipse(ballPos.x, ballPos.y, ballRadius, ballRadius, 0, 0, Math.PI * 2)
    ctx.fill()

    // render pegs
    const topPegRow = Math.max(0, Math.floor(gameYOffset / columnWidth))
    for (
      let row = topPegRow;
      row < Math.ceil(gameHeight / columnWidth);
      row++
    ) {
      for (let cx = 0; cx < gameWidth; cx += columnWidth) {
        ctx.fillStyle = plinko.style.getPropertyValue("--peg-color")
        ctx.beginPath()
        ctx.ellipse(
          cx,
          row * columnWidth - gameYOffset,
          pegRadius,
          pegRadius,
          0,
          0,
          Math.PI * 2
        )
        ctx.fill()
      }
    }

    // Reset current transformation matrix to the identity matrix
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  // Listen for resize events
  window.addEventListener("resize", () => {
    const bb = plinko.getBoundingClientRect()
    canvas.width = bb.width
    canvas.height = bb.height

    plinko.style.setProperty(
      "--start-btn-size",
      `${(0.8 * bb.width) / columns}px`
    )

    // re-render frame
    render()
  })

  // Define game loop
  const play = () => {
    // Game logic

    // Request next frame
    if (gameState === "playing") requestAnimationFrame(play)

    // Render frame
    render()
  }

  // Add start button listeners
  for (const startButton of startButtons) {
    const position = parseInt(startButton.getAttribute("data-position"))
    startButton.addEventListener("click", () => {
      gameState = "playing"
      ballPos.x = (gameWidth * (position + 0.5)) / columns
      play()
    })
  }

  // Render first frame
  render()
})
