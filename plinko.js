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
  const prizeRowFrequency = 8
  const prizeRowColPerSec = 1.5
  const spikesPerCol = 7
  let gameHeight = 100
  let scale = 1
  let lastFrameTime = 0
  let totalPlayTime = 0
  let gameState = {
    state: "ready", // ready / playing / done / paused
    frame: 0,
    ms: 0,
    ball: {
      pos: { x: -2 * ballRadius, y: -rowHeight },
      rot: 0,
      rotVel: 0,
      vel: { x: 0, y: 0 },
      acc: { x: 0, y: 100 },
    },
    nextPrizeRow: 0,
  }
  let futureGameState = null
  let prizes = [
    {
      size: 10000,
      count: 1,
      userOdds: 0.00001,
      userWon: 1,
    },
    {
      size: 1000,
      count: 10,
      userOdds: 0.0001,
      userWon: 0,
    },
    {
      size: 500,
      count: 20,
      userOdds: 0.0002,
      userWon: 0,
    },
    {
      size: 10,
      count: 256,
      userOdds: 0.001,
      userWon: 1,
    },
    {
      size: 0.5,
      count: 1024,
      userOdds: 0.005,
      userWon: 5,
    },
  ]
  const maxPrizeSize = Math.max(...prizes.map((x) => x.size))

  let prizeRows = []
  let prizeRowPathOffset = []

  // Build Prize Rows
  let lowestChanceWinOdds = 1
  prizes.forEach((prize, i) => {
    // Fill with prizes they won
    for (let p = 0; p < prize.userWon; p++) {
      const prizeRow = Array(columns).fill("^") // spikes
      prizeRow[0] = i // prize
      prizeRow[Math.floor(columns / 2)] = " " // gap
      prizeRows.push(prizeRow)
    }

    // Then add prizes they could have won statistically
    const notWon = prize.count - prize.userWon
    if (notWon > 0) {
      for (let n = 0; n < notWon; n++) {
        if (Math.random() <= prize.userOdds) {
          const prizeRow = Array(columns).fill("^") // spikes
          prizeRow[0] = " " // gap
          prizeRow[Math.floor(columns / 2)] = i // prize
          prizeRows.push(prizeRow)
        }
      }
    }

    // Record lowest chance if they won
    if (prize.userWon > 0 && prize.userOdds < lowestChanceWinOdds) {
      lowestChanceWinOdds = prize.userOdds
    }
  })

  // Add empty rows equal to the lowest chance prize that they won
  const minRows = 1 + Math.log(1 / lowestChanceWinOdds) / Math.log(columns / 2) // 2 gaps every row defines the odds of passing the row
  while (prizeRows.length < minRows) {
    const prizeRow = Array(columns).fill("^") // spikes
    prizeRow[0] = " " // gap
    prizeRow[Math.floor(columns / 2)] = " " // gap
    prizeRows.push(prizeRow)
  }

  // Shuffle Prize Rows
  // prizeRows

  // Create 2D context
  const ctx = canvas.getContext("2d")

  // Define render call
  const render = (ballPos, ballRotation, gameMs) => {
    // Set camera position
    let gameYOffset = -rowHeight - marginTop - ballRadius
    if (ballPos.y >= rowHeight * 2) gameYOffset += ballPos.y - rowHeight * 2

    // clear and scale
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(1 / scale, 1 / scale)

    // render pegs
    const topPegRow = Math.max(0, Math.floor(gameYOffset / rowHeight))
    for (
      let row = topPegRow;
      row <= topPegRow + Math.ceil(gameHeight / rowHeight);
      row++
    ) {
      const rowY = row * rowHeight - gameYOffset

      // Check if Prize Row
      const isPrizeRow = row > 0 && row % prizeRowFrequency == 0
      if (isPrizeRow) {
        const prizeRowIndex = row / prizeRowFrequency - 1
        const prizeRow = prizeRows[prizeRowIndex]
        if (prizeRow) {
          const prizeColDir = prizeRowIndex % 2 == 0 ? -1 : 1
          const prizeRowOffset =
            ((prizeColDir * columnWidth * (prizeRowColPerSec * gameMs)) /
              1000) %
            gameWidth
          for (let i = 0; i < columns * 2; i++) {
            const prizeIndex = (i + prizeRowPathOffset[prizeRowIndex]) % columns
            const pegX =
              i * columnWidth +
              prizeRowOffset -
              (prizeColDir > 0 ? gameWidth : 0) // start behind by 1 row if moving forward
            if (pegX + columnWidth > 0 && pegX - columnWidth < gameWidth) {
              if (prizeRow[prizeIndex] === "^") {
                // Draw spikes
                ctx.fillStyle = plinko
                  .computedStyleMap()
                  .get("--spike-color")[0]
                ctx.beginPath()
                ctx.moveTo(pegX, rowY + pegRadius)
                ctx.lineTo(pegX + pegRadius, rowY)
                for (let s = 1; s <= spikesPerCol * 2; s++) {
                  ctx.lineTo(
                    pegX +
                      pegRadius +
                      (s * (columnWidth - pegRadius * 2)) / (spikesPerCol * 2),
                    s % 2 == 0 ? rowY : rowY - pegRadius
                  )
                }
                ctx.lineTo(pegX + columnWidth, rowY + pegRadius)
                ctx.fill()
              } else if (Number.isInteger(prizeRow[prizeIndex])) {
                // Draw Prize
                const prize = prizes[prizeRow[prizeIndex]]
                const prizeLogScale =
                  1 - Math.log(prize.size + 1) / Math.log(maxPrizeSize + 1)
                const prizeRadius =
                  pegRadius + (ballRadius - pegRadius) * prizeLogScale
                ctx.fillStyle = plinko
                  .computedStyleMap()
                  .get(
                    `--prize-${Math.floor((1 - prizeLogScale) * 8)}-color`
                  )[0]
                ctx.strokeStyle = `hsla(${
                  Math.floor((360 * gameMs) / 1000) % 360
                }, 100%, 50%, 0.6)`
                ctx.lineWidth = 0.5
                ctx.setLineDash([1, 1])
                ctx.lineDashOffset = gameMs / 500

                ctx.beginPath()
                ctx.ellipse(
                  pegX + columnWidth / 2,
                  rowY,
                  (columnWidth - pegRadius * 3) / 2,
                  pegRadius / 2,
                  0,
                  Math.PI,
                  Math.PI * 2
                )
                ctx.stroke()

                ctx.beginPath()
                ctx.ellipse(
                  pegX + columnWidth / 2,
                  rowY + prizeRadius / 2,
                  prizeRadius,
                  prizeRadius,
                  0,
                  0,
                  Math.PI * 2
                )
                ctx.fill()

                ctx.beginPath()
                ctx.ellipse(
                  pegX + columnWidth / 2,
                  rowY,
                  (columnWidth - pegRadius * 3) / 2,
                  pegRadius / 2,
                  0,
                  0,
                  Math.PI
                )
                ctx.stroke()
              }

              // Draw peg
              ctx.fillStyle = plinko.computedStyleMap().get("--peg-color")[0]
              ctx.beginPath()
              ctx.ellipse(pegX, rowY, pegRadius, pegRadius, 0, 0, Math.PI * 2)
              ctx.fill()
            }
          }
        }
      } else {
        // Normal Row Rendering
        for (let col = 0; col <= columns; col++) {
          // Draw peg
          ctx.fillStyle = plinko.computedStyleMap().get("--peg-color")[0]
          const evenRow = row % 2 == 0
          ctx.beginPath()
          ctx.ellipse(
            (evenRow ? col : col + 0.5) * columnWidth,
            rowY,
            pegRadius,
            pegRadius,
            0,
            0,
            Math.PI * 2
          )
          ctx.fill()
        }
      }
    }

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

    // Reset current transformation matrix to the identity matrix
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  // Listen for resize events
  const resize = () => {
    const bb = plinko.getBoundingClientRect()
    canvas.width = bb.width
    canvas.height = bb.height

    scale = gameWidth / canvas.width
    gameHeight = scale * canvas.height

    plinko.style.setProperty(
      "--start-btn-size",
      `${(0.8 * bb.width) / columns}px`
    )

    // re-render frame
    render(gameState.ball.pos, gameState.ball.rot, totalPlayTime)
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
      let colOffset,
        pegVelocity = { x: 0, y: 0 }

      // Check if prize row is closest
      if (nearestPegRow > 0 && nearestPegRow % prizeRowFrequency == 0) {
        const prizeRowIndex = nearestPegRow / prizeRowFrequency - 1

        // set col offset
        pegVelocity = {
          x:
            prizeRowColPerSec * columnWidth * (prizeRowIndex % 2 == 0 ? -1 : 1),
          y: 0,
        }
        colOffset = ((pegVelocity.x * n.ms) / 1000) % columnWidth
      } else {
        colOffset = nearestPegRow % 2 == 0 ? 0 : columnWidth / 2
      }
      const nearestPegCol = Math.round((n.ball.pos.x - colOffset) / columnWidth)
      const pegPos = {
        x: nearestPegCol * columnWidth + colOffset,
        y: nearestPegRow * rowHeight,
      }
      if (dist(n.ball.pos, pegPos) < ballRadius + pegRadius) {
        // Bounce
        const diff = { x: pegPos.x - n.ball.pos.x, y: pegPos.y - n.ball.pos.y }
        const angleOfHit = angleBetween(diff, n.ball.vel)
        if (angleOfHit < Math.PI / 2) {
          const perpendicularVel = project(n.ball.vel, diff)
          const parallelVel = sub(n.ball.vel, perpendicularVel)
          n.ball.vel = add(
            parallelVel,
            smul(perpendicularVel, -collisionElasticity)
          )

          // Check if peg transfers velocity to ball
          if (pegVelocity.x != 0) {
            const negDiff = neg(diff)
            const angleOfTransfer = angleBetween(pegVelocity, negDiff)
            if (angleOfTransfer < Math.PI / 2) {
              n.ball.vel = add(
                n.ball.vel,
                smul(pegVelocity, Math.cos(angleOfTransfer))
              )
            }
          }

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

    // Check if ball has passed the next prize row
    if (n.ball.pos.y >= (n.nextPrizeRow + 1) * rowHeight * prizeRowFrequency) {
      n.nextPrizeRow++
    }

    return n
  }

  // Define game loop
  const play = () => {
    if (gameState.state === "playing") {
      // Request next frame
      requestAnimationFrame(play)
      const now = performance.now()
      const timeSinceLastFrame = Math.min(frameStepMs, now - lastFrameTime) // limit animation frame time to frame step
      totalPlayTime += timeSinceLastFrame
      lastFrameTime = now

      // Get next game state
      const nextState = getNextFrameState(gameState)
      if (totalPlayTime >= nextState.ms) {
        gameState = nextState
      }

      // Simulate future game states until out of frame
      if (futureGameState === null) futureGameState = nextState
      while (
        futureGameState.ball.pos.y <
        nextState.ball.pos.y + gameHeight * 1.5
      ) {
        const nextPrizeRow = futureGameState.nextPrizeRow
        futureGameState = getNextFrameState(futureGameState)
        if (futureGameState.nextPrizeRow > nextPrizeRow) {
          // record prize offset
          let goalPegX =
            ((prizeRowColPerSec *
              columnWidth *
              (nextPrizeRow % 2 == 0 ? -1 : 1) *
              futureGameState.ms) /
              1000) %
            gameWidth
          if (goalPegX < 0) {
            goalPegX += gameWidth
          }
          prizeRowPathOffset[nextPrizeRow] =
            Math.floor((futureGameState.ball.pos.x - goalPegX) / columnWidth) %
            columns
          if (prizeRowPathOffset[nextPrizeRow] < 0) {
            prizeRowPathOffset[nextPrizeRow] += columns
          }
          prizeRowPathOffset[nextPrizeRow] =
            (columns - prizeRowPathOffset[nextPrizeRow]) % columns
          prizeRows.push(prizeRows[0])
        }
      }

      // Render frame with interpolated ball position
      const frameTime = Math.min(totalPlayTime, nextState.ms)
      const t = (frameTime - gameState.ms) / frameStepMs
      const iBallPos = add(
        smul(gameState.ball.pos, 1 - t),
        smul(nextState.ball.pos, t)
      )
      render(iBallPos, gameState.ball.rot, frameTime)
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
