window.addEventListener("load", () => {
  // Get elements
  const plinko = document.getElementById("plinko")
  const canvas = plinko.querySelector("canvas")
  const startButtons = [...plinko.querySelectorAll(".start-btn")]

  // Assets
  const poolLogoSvg = document.createElement("img")
  poolLogoSvg.src = "./img/pool-logo.svg"

  // Define game state
  const gameWidth = 100
  const columns = startButtons.length
  const columnWidth = gameWidth / columns
  const rowHeight = columnWidth * 0.75
  const ballRadius = columnWidth / 5
  const pegRadius = columnWidth * 0.1
  const marginTop = ballRadius
  const maxSpeed = 90
  const maxRotVel = 10
  const frameStepMs = 25 // 40 fps physics updates
  const collisionElasticity = 0.3
  let lastFrameTime = 0
  let totalPlayTime = 0
  let gameState = {
    state: "ready", // ready / playing / done
    frame: 0,
    ms: 0,
    ball: {
      pos: { x: -2 * ballRadius, y: 0 },
      rot: 0,
      rotVel: 0,
      vel: { x: 0, y: 0 },
      acc: { x: 0, y: 100 },
    },
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === " ") {
      gameState.state = "done"
    }
  })

  // Create 2D context
  const ctx = canvas.getContext("2d")

  // Define render call
  const render = (ballPos, ballRotation) => {
    // Set camera position
    let gameYOffset = -marginTop - ballRadius
    if (ballPos.y >= rowHeight * 2) gameYOffset += ballPos.y - rowHeight * 2

    // clear and scale
    const scale = gameWidth / canvas.width
    const gameHeight = scale * canvas.height
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(1 / scale, 1 / scale)

    // render ball
    ctx.fillStyle = plinko.computedStyleMap().get("--ball-color")[0]
    ctx.beginPath()
    ctx.ellipse(
      ballPos.x,
      ballPos.y - gameYOffset,
      ballRadius,
      ballRadius,
      0,
      0,
      Math.PI * 2
    )
    ctx.fill()
    ctx.save()
    ctx.translate(ballPos.x, ballPos.y - gameYOffset)
    ctx.rotate(ballRotation)
    ctx.translate(-ballPos.x, gameYOffset - ballPos.y)
    ctx.drawImage(
      poolLogoSvg,
      ballPos.x - ballRadius * 0.66,
      ballPos.y - gameYOffset - ballRadius * 0.66,
      ballRadius * 1.32,
      ballRadius * 1.32
    )
    ctx.restore()

    // render pegs
    const topPegRow = Math.max(1, Math.floor(gameYOffset / rowHeight))
    for (
      let row = topPegRow;
      row <= topPegRow + Math.ceil(gameHeight / rowHeight);
      row++
    ) {
      for (let col = 0; col < columns + 1; col++) {
        const oddRow = row % 2 != 0
        ctx.fillStyle = plinko.computedStyleMap().get("--peg-color")[0]
        ctx.beginPath()
        ctx.ellipse(
          (oddRow ? col : col + 0.5) * columnWidth,
          row * rowHeight - gameYOffset,
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
  const resize = () => {
    const bb = plinko.getBoundingClientRect()
    canvas.width = bb.width
    canvas.height = bb.height

    plinko.style.setProperty(
      "--start-btn-size",
      `${(0.8 * bb.width) / columns}px`
    )

    // re-render frame
    render(gameState.ball.pos)
  }
  window.addEventListener("resize", resize)

  // Function to get the game state for the next frame
  const getNextFrameState = (state) => {
    const n = JSON.parse(JSON.stringify(state))
    n.frame++
    n.ms = state.ms + frameStepMs

    // Update velocity
    n.ball.vel.x += (n.ball.acc.x * frameStepMs) / 1000
    n.ball.vel.y += (n.ball.acc.y * frameStepMs) / 1000

    // Cap speed
    const speed = Math.sqrt(
      n.ball.vel.x * n.ball.vel.x + n.ball.vel.y * n.ball.vel.y
    )
    if (speed > maxSpeed) {
      n.ball.vel.x = (maxSpeed * n.ball.vel.x) / speed
      n.ball.vel.y = (maxSpeed * n.ball.vel.y) / speed
    }

    // Move ball
    n.ball.pos.x += (n.ball.vel.x * frameStepMs) / 1000
    n.ball.pos.y += (n.ball.vel.y * frameStepMs) / 1000

    // Rotate ball
    n.ball.rot += (n.ball.rotVel * frameStepMs) / 1000

    // Check for wall collisions
    if (n.ball.pos.x < ballRadius) {
      n.ball.pos.x = ballRadius
      if (n.ball.vel.x < 0) {
        n.ball.vel.x *= -1
      }
      n.ball.vel.x *= collisionElasticity
      n.ball.rotVel += 2
    }
    if (n.ball.pos.x > gameWidth - ballRadius) {
      n.ball.pos.x = gameWidth - ballRadius
      if (n.ball.vel.x > 0) {
        n.ball.vel.x *= -1
      }
      n.ball.vel.x *= collisionElasticity
      n.ball.rotVel -= 2
    }

    // Check for peg collisions
    const nearestPegRow = Math.round(n.ball.pos.y / rowHeight)
    if (nearestPegRow > 0) {
      const colOffset = nearestPegRow % 2 == 0 ? columnWidth / 2 : 0
      const nearestPegCol = Math.round((n.ball.pos.x - colOffset) / columnWidth)
      const pegPos = {
        x: nearestPegCol * columnWidth + colOffset,
        y: nearestPegRow * rowHeight,
      }
      if (dist(n.ball.pos, pegPos) < ballRadius + pegRadius) {
        // Bounce
        const diff = { x: pegPos.x - n.ball.pos.x, y: pegPos.y - n.ball.pos.y }
        const angleOfHit = angleBetween(pegPos, n.ball.pos)
        if (angleOfHit < Math.PI / 2) {
          const perpendicularVel = project(n.ball.vel, diff)
          const parallelVel = sub(n.ball.vel, perpendicularVel)
          n.ball.vel = add(
            parallelVel,
            smul(perpendicularVel, -collisionElasticity)
          )

          // Spin ball based on collision
          n.ball.rotVel *= 0.5
          n.ball.rotVel +=
            0.25 *
            mag(parallelVel) *
            (parallelVel.y > 0 ? -1 : 1) *
            (n.ball.vel.x > 0 ? -1 : 1)
        }

        // Push ball away
        const pushedDiff = smul(norm(diff), -1 * (ballRadius + pegRadius))
        n.ball.pos = add(pegPos, pushedDiff)
      }
    }

    // Cap ball rotational velocity
    if (n.ball.rotVel > maxRotVel) {
      n.ball.rotVel = maxRotVel
    }
    if (n.ball.rotVel < -maxRotVel) {
      n.ball.rotVel = -maxRotVel
    }

    return n
  }

  // Define game loop
  const play = () => {
    if (gameState.state === "playing") {
      // Request next frame
      requestAnimationFrame(play)
      const now = performance.now()
      totalPlayTime += now - lastFrameTime
      lastFrameTime = now

      const nextState = getNextFrameState(gameState)
      if (totalPlayTime >= nextState.ms) {
        gameState = nextState
      }

      // Render frame with interpolated ball position
      const t = Math.min(1, (totalPlayTime - gameState.ms) / frameStepMs)
      const iBallPos = add(
        smul(gameState.ball.pos, 1 - t),
        smul(nextState.ball.pos, t)
      )
      render(iBallPos, gameState.ball.rot)
    }
  }

  // Add start button listeners
  for (const startButton of startButtons) {
    const position = parseInt(startButton.getAttribute("data-position"))
    startButton.addEventListener("click", () => {
      gameState.state = "playing"
      lastFrameTime = performance.now()
      plinko.classList.add("playing")
      gameState.ball.pos.x =
        (gameWidth * (position + 0.4 + 0.2 * Math.random())) / columns
      play()
    })
  }

  // Resize and render first frame
  resize()
})

// Distance between two points
const dist = (a, b) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

// Magnitude of a vector
const mag = (a) => {
  return Math.sqrt(a.x * a.x + a.y * a.y)
}

// The normal of the vector
const norm = (a) => {
  const m = mag(a)
  return {
    x: a.x / m,
    y: a.y / m,
  }
}

// Dot product of a vector
const dot = (a, b) => {
  return a.x * b.x + a.y * b.y
}

// Returns the negative vector of a
const neg = (a) => {
  return {
    x: -a.x,
    y: -a.y,
  }
}

// Returns the vector subtraction of a - b
const sub = (a, b) => {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  }
}

// Returns the addition of vectors a and b
const add = (a, b) => {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
  }
}

// Returns the scalar multiple of vector a times scalar s
const smul = (a, s) => {
  return {
    x: a.x * s,
    y: a.y * s,
  }
}

// Angle between two vectors [0, PI]
const angleBetween = (a, b) => {
  return Math.acos(dot(a, b) / (mag(a) * mag(b)))
}

// Projects vector a on vector b and returns the resulting vector
const project = (a, b) => {
  const angle = angleBetween(a, b)
  const projectionMag = mag(a) * Math.cos(angle)
  const bMag = mag(b)
  return {
    x: (projectionMag * b.x) / bMag,
    y: (projectionMag * b.y) / bMag,
  }
}
