class GridAnimation {
	constructor(canvas, options = {}) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.options = {
			direction: options.direction || "right",
			speed: options.speed || 1,
			borderColor: options.borderColor || "rgba(255, 255, 255, 0.05)",
			squareSize: options.squareSize || 40,
			hoverFillColor: options.hoverFillColor || "rgba(255, 255, 255, 0.6)",
			hoverShadowColor: options.hoverShadowColor || "rgba(255, 255, 255, 0.3)",
			transitionDuration: options.transitionDuration || 200, // 过渡时间（毫秒）
			trailDuration: options.trailDuration || 1000, // 痕迹持续时间（毫秒）
			specialBlockColor:
				options.specialBlockColor || "rgba(255, 100, 100, 0.8)",
			specialHoverColor:
				options.specialHoverColor || "rgba(100, 255, 100, 0.8)",
			// 新增颜色渐变相关选项
			snakeHeadColor: options.snakeHeadColor || "rgba(255, 255, 255, 0.9)",
			snakeTailColor: options.snakeTailColor || "rgba(100, 100, 255, 0.3)",
			snakeGradientStops: options.snakeGradientStops || 5, // 渐变过渡的色块数
			snakeColorDecay: options.snakeColorDecay || 0.7, // 渐变衰减系数，越小衰减越快
			// 移动端触摸相关选项
			touchSensitivity: options.touchSensitivity || 1.0, // 触摸灵敏度
			vibrationEnabled: options.vibrationEnabled || false, // 是否启用震动反馈
			...options,
		};

		this.gridOffset = { x: 0, y: 0 };
		this.hoveredSquare = null;
		this.animationFrame = null;
		this.currentOpacity = 0;
		this.targetOpacity = 0;
		this.lastTimestamp = 0;
		this.hoverRadius = 3;
		this.trailSquares = new Map(); // 存储痕迹格子的信息
		this.specialBlock = null;
		this.specialBlockTimer = null;
		this.isSpecialBlockHovered = false;
		this.snakeBody = []; // 存储蛇身的数组
		this.shouldGrow = false; // 控制蛇身是否增长
	}

	init() {
		this.resizeCanvas();
		this.setupEventListeners();

		// 移动端性能优化
		if (isPhone) {
			this.optimizeForMobile();
		}

		this.animate();

		// 在移动设备上延迟创建食物，确保画布大小计算正确
		if (isPhone) {
			setTimeout(() => {
				this.createSpecialBlock();
			}, 500);
		} else {
			this.createSpecialBlock();
		}

		// 添加页面可见性变化监听，在页面不可见时暂停动画
		document.addEventListener(
			visibilityChangeEvent,
			this.handleVisibilityChange.bind(this)
		);
	}

	optimizeForMobile() {
		// 检测设备性能, 默认高性能模式
		const canvas = this.canvas;
		const ctx = canvas.getContext("2d");

		// 简单的性能测试
		const startTime = performance.now();
		for (let i = 0; i < 1000; i++) {
			ctx.fillRect(0, 0, 1, 1);
		}
		const endTime = performance.now();
		const performanceScore = endTime - startTime;

		// 根据性能调整设置
		if (performanceScore > 10) {
			// 低性能设备
			this.options.squareSize = Math.max(this.options.squareSize * 1.5, 60);
			this.options.speed *= 0.7;
			this.options.trailDuration *= 0.5;
		} else if (performanceScore > 5) {
			// 中等性能设备
			this.options.squareSize = Math.max(this.options.squareSize * 1.2, 50);
			this.options.speed *= 0.8;
		}
	}

	resizeCanvas() {
		// 处理设备像素比，确保在高DPR设备上（如iPhone）清晰渲染
		const dpr = window.devicePixelRatio || 1;
		const displayWidth = this.canvas.offsetWidth;
		const displayHeight = this.canvas.offsetHeight;

		// 设置画布大小为实际像素大小
		this.canvas.width = Math.floor(displayWidth * dpr);
		this.canvas.height = Math.floor(displayHeight * dpr);

		// 设置CSS尺寸为显示尺寸
		this.canvas.style.width = `${displayWidth}px`;
		this.canvas.style.height = `${displayHeight}px`;

		// 缩放上下文以匹配设备像素比
		this.ctx.scale(dpr, dpr);
	}

	setupEventListeners() {
		window.addEventListener("resize", () => this.resizeCanvas());
		this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
		this.canvas.addEventListener("mouseleave", () => this.handleMouseLeave());

		// 移动端触摸事件处理
		if (isPhone) {
			this.setupTouchEvents();
		}

		// 监听设备方向变化，重新创建食物
		if (isPhone && window.orientation !== undefined) {
			window.addEventListener("orientationchange", () => {
				setTimeout(() => {
					this.resizeCanvas();
					this.createSpecialBlock();
				}, 300);
			});
		}
	}

	setupTouchEvents() {
		let touchStartPos = null;
		let touchMovePos = null;
		let isTouching = false;
		let lastTouchTime = 0;
		let touchCount = 0;

		// 保存事件处理函数引用以便后续移除
		this.handleTouchStart = (e) => {
			e.preventDefault();
			const now = Date.now();

			// 防止过于频繁的触摸事件
			if (now - lastTouchTime < 16) {
				// 约60fps限制
				return;
			}
			lastTouchTime = now;

			if (e.touches.length === 1) {
				const touch = e.touches[0];
				const rect = this.canvas.getBoundingClientRect();
				touchStartPos = {
					x: touch.clientX - rect.left,
					y: touch.clientY - rect.top,
					time: now,
				};
				isTouching = true;
				touchCount++;

				// 立即处理触摸开始位置
				this.handleTouchMove(touchStartPos.x, touchStartPos.y);

				// 如果之前没有蛇头，设置目标透明度
				if (!this.hoveredSquare) {
					this.targetOpacity = 0.8 * this.options.touchSensitivity;
				}

				// 添加触摸开始时的视觉反馈
				if (this.options.vibrationEnabled && navigator.vibrate) {
					navigator.vibrate(10); // 轻微震动反馈
				}
			}
		};

		this.handleTouchMoveEvent = (e) => {
			e.preventDefault();
			if (isTouching && e.touches.length === 1) {
				const touch = e.touches[0];
				const rect = this.canvas.getBoundingClientRect();
				touchMovePos = {
					x: touch.clientX - rect.left,
					y: touch.clientY - rect.top,
				};

				// 处理触摸移动
				this.handleTouchMove(touchMovePos.x, touchMovePos.y);
			}
		};

		this.handleTouchEndEvent = (e) => {
			e.preventDefault();
			const now = Date.now();

			// 检测双击手势
			if (touchStartPos && now - touchStartPos.time < 300) {
				touchCount++;
				if (touchCount === 2) {
					// 双击重置蛇身
					this.resetSnake();
					touchCount = 0;

					// 双击震动反馈
					if (this.options.vibrationEnabled && navigator.vibrate) {
						navigator.vibrate([50, 50, 50]); // 三次短震动
					}
					return;
				}
			} else {
				touchCount = 0;
			}

			isTouching = false;
			touchStartPos = null;
			touchMovePos = null;

			// 触摸结束时添加痕迹
			this.handleTouchEnd();
		};

		this.handleTouchCancel = (e) => {
			e.preventDefault();
			isTouching = false;
			touchStartPos = null;
			touchMovePos = null;
		};

		// 添加事件监听器
		this.canvas.addEventListener("touchstart", this.handleTouchStart, {
			passive: false,
		});
		this.canvas.addEventListener("touchmove", this.handleTouchMoveEvent, {
			passive: false,
		});
		this.canvas.addEventListener("touchend", this.handleTouchEndEvent, {
			passive: false,
		});
		this.canvas.addEventListener("touchcancel", this.handleTouchCancel, {
			passive: false,
		});
	}

	handleTouchMove(x, y) {
		const startX =
			Math.floor(this.gridOffset.x / this.options.squareSize) *
			this.options.squareSize;
		const startY =
			Math.floor(this.gridOffset.y / this.options.squareSize) *
			this.options.squareSize;

		const hoveredSquareX = Math.floor(
			(x + this.gridOffset.x - startX) / this.options.squareSize
		);
		const hoveredSquareY = Math.floor(
			(y + this.gridOffset.y - startY) / this.options.squareSize
		);

		if (
			this.hoveredSquare?.x !== hoveredSquareX ||
			this.hoveredSquare?.y !== hoveredSquareY
		) {
			// 将当前悬停的格子添加到蛇身
			if (this.hoveredSquare) {
				this.snakeBody.unshift({
					x: this.hoveredSquare.x,
					y: this.hoveredSquare.y,
				});

				// 如果没有吃到食物，移除蛇尾
				if (!this.shouldGrow && this.snakeBody.length > 0) {
					this.snakeBody.pop();
				}
				this.shouldGrow = false;
			}

			this.hoveredSquare = { x: hoveredSquareX, y: hoveredSquareY };
			// 当用户正在触摸时，设置较高的透明度
			this.targetOpacity = 0.8 * this.options.touchSensitivity;

			// 检查是否吃到食物
			if (
				this.specialBlock &&
				hoveredSquareX === this.specialBlock.x &&
				hoveredSquareY === this.specialBlock.y
			) {
				this.shouldGrow = true;
				this.createSpecialBlock();

				// 移动端吃到食物时的触觉反馈
				if (this.options.vibrationEnabled && navigator.vibrate) {
					navigator.vibrate(100);
				}
			}
		}
	}

	handleTouchEnd() {
		if (this.hoveredSquare) {
			// 将当前悬停的格子添加到蛇身
			this.snakeBody.unshift({
				x: this.hoveredSquare.x,
				y: this.hoveredSquare.y,
			});

			// 如果没有吃到食物，移除蛇尾
			if (!this.shouldGrow && this.snakeBody.length > 0) {
				this.snakeBody.pop();
			}
			this.shouldGrow = false;

			const startX =
				Math.floor(this.gridOffset.x / this.options.squareSize) *
				this.options.squareSize;
			const startY =
				Math.floor(this.gridOffset.y / this.options.squareSize) *
				this.options.squareSize;
			const key = `${this.hoveredSquare.x},${this.hoveredSquare.y}`;
			this.trailSquares.set(key, {
				x: this.hoveredSquare.x * this.options.squareSize + startX,
				y: this.hoveredSquare.y * this.options.squareSize + startY,
				opacity: 0.8,
			});
		}

		// 保持蛇身状态，不重置 hoveredSquare
		// 但降低透明度以显示触摸已结束
		if (this.hoveredSquare) {
			this.targetOpacity = 0.4; // 保持较低的透明度显示蛇头位置
		}
	}

	resetSnake() {
		// 重置蛇身
		this.snakeBody = [];
		this.hoveredSquare = null;
		this.targetOpacity = 0;

		// 清除所有痕迹
		this.trailSquares.clear();

		// 重新创建食物
		this.createSpecialBlock();

		// 添加重置的视觉反馈
		if (this.options.vibrationEnabled && navigator.vibrate) {
			navigator.vibrate(200); // 长震动表示重置
		}
	}

	handleMouseMove(event) {
		const rect = this.canvas.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;
		const mouseY = event.clientY - rect.top;

		const startX =
			Math.floor(this.gridOffset.x / this.options.squareSize) *
			this.options.squareSize;
		const startY =
			Math.floor(this.gridOffset.y / this.options.squareSize) *
			this.options.squareSize;

		const hoveredSquareX = Math.floor(
			(mouseX + this.gridOffset.x - startX) / this.options.squareSize
		);
		const hoveredSquareY = Math.floor(
			(mouseY + this.gridOffset.y - startY) / this.options.squareSize
		);

		if (
			this.hoveredSquare?.x !== hoveredSquareX ||
			this.hoveredSquare?.y !== hoveredSquareY
		) {
			// 将当前悬停的格子添加到蛇身
			if (this.hoveredSquare) {
				this.snakeBody.unshift({
					x: this.hoveredSquare.x,
					y: this.hoveredSquare.y,
				});

				// 如果没有吃到食物，移除蛇尾
				if (!this.shouldGrow && this.snakeBody.length > 0) {
					this.snakeBody.pop();
				}
				this.shouldGrow = false;
			}

			this.hoveredSquare = { x: hoveredSquareX, y: hoveredSquareY };
			this.targetOpacity = 0.6;

			// 检查是否吃到食物
			if (
				this.specialBlock &&
				hoveredSquareX === this.specialBlock.x &&
				hoveredSquareY === this.specialBlock.y
			) {
				this.shouldGrow = true; // 标记蛇身需要增长
				this.createSpecialBlock(); // 吃到食物时立即生成新的食物
			}
		}
	}

	handleMouseLeave() {
		if (this.hoveredSquare) {
			const startX =
				Math.floor(this.gridOffset.x / this.options.squareSize) *
				this.options.squareSize;
			const startY =
				Math.floor(this.gridOffset.y / this.options.squareSize) *
				this.options.squareSize;
			const key = `${this.hoveredSquare.x},${this.hoveredSquare.y}`;
			this.trailSquares.set(key, {
				x: this.hoveredSquare.x * this.options.squareSize + startX,
				y: this.hoveredSquare.y * this.options.squareSize + startY,
				opacity: 0.6,
			});
		}
		this.hoveredSquare = null;
		this.targetOpacity = 0;
	}

	createSpecialBlock() {
		// 清除之前的定时器
		if (this.specialBlockTimer) {
			clearTimeout(this.specialBlockTimer);
		}

		// 获取设备像素比
		const dpr = window.devicePixelRatio || 1;

		// 随机生成特殊方块的位置
		const numSquaresX = Math.ceil(
			this.canvas.width / dpr / this.options.squareSize
		);
		const numSquaresY = Math.ceil(
			this.canvas.height / dpr / this.options.squareSize
		);

		// 确保食物不会生成在蛇身上和边缘
		let newX, newY;
		do {
			// 避开边缘，留出1格的空间
			newX = 1 + Math.floor(Math.random() * (numSquaresX - 2));
			newY = 1 + Math.floor(Math.random() * (numSquaresY - 2));
		} while (
			this.snakeBody.some((segment) => segment.x === newX && segment.y === newY)
		);

		this.specialBlock = {
			x: newX,
			y: newY,
			color: this.options.specialBlockColor,
			initialOffset: { ...this.gridOffset },
		};
	}

	drawGrid() {
		const dpr = window.devicePixelRatio || 1;

		// 清除前重置变换
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// 应用DPR比例
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		const startX =
			Math.floor(this.gridOffset.x / this.options.squareSize) *
			this.options.squareSize;
		const startY =
			Math.floor(this.gridOffset.y / this.options.squareSize) *
			this.options.squareSize;

		// 增加边框线宽度，特别是在iOS设备上
		this.ctx.lineWidth = isPhone ? 1.0 : 0.5;

		// 为iOS设备优化渲染，避免边框闪烁
		if (isPhone) {
			this.ctx.translate(0.5, 0.5); // 在iOS上对齐像素
		}

		// 绘制蛇身
		this.snakeBody.forEach((segment, index) => {
			const squareX = Math.round(
				segment.x * this.options.squareSize +
					startX -
					(this.gridOffset.x % this.options.squareSize)
			);
			const squareY = Math.round(
				segment.y * this.options.squareSize +
					startY -
					(this.gridOffset.y % this.options.squareSize)
			);

			this.ctx.shadowColor = this.options.hoverShadowColor;
			this.ctx.shadowBlur = 15;
			this.ctx.shadowOffsetX = 0;
			this.ctx.shadowOffsetY = 0;

			// 计算蛇身颜色渐变
			if (index === 0) {
				// 蛇头使用特殊颜色
				this.ctx.fillStyle = this.options.snakeHeadColor;
			} else {
				// 计算渐变系数
				const gradientFactor = Math.pow(this.options.snakeColorDecay, index);

				// 解析头部和尾部颜色
				const headColorMatch = this.options.snakeHeadColor.match(
					/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([.\d]+))?\)/
				);
				const tailColorMatch = this.options.snakeTailColor.match(
					/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([.\d]+))?\)/
				);

				if (headColorMatch && tailColorMatch) {
					const headR = parseInt(headColorMatch[1]);
					const headG = parseInt(headColorMatch[2]);
					const headB = parseInt(headColorMatch[3]);
					const headA = headColorMatch[4] ? parseFloat(headColorMatch[4]) : 1;

					const tailR = parseInt(tailColorMatch[1]);
					const tailG = parseInt(tailColorMatch[2]);
					const tailB = parseInt(tailColorMatch[3]);
					const tailA = tailColorMatch[4] ? parseFloat(tailColorMatch[4]) : 1;

					// 计算中间渐变色
					const r = Math.round(headR + (tailR - headR) * (1 - gradientFactor));
					const g = Math.round(headG + (tailG - headG) * (1 - gradientFactor));
					const b = Math.round(headB + (tailB - headB) * (1 - gradientFactor));
					const a = headA + (tailA - headA) * (1 - gradientFactor);

					this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
				} else {
					// 回退到简单透明度渐变
					const opacity = Math.max(0.2, gradientFactor);
					this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
				}
			}

			this.ctx.fillRect(
				squareX,
				squareY,
				this.options.squareSize,
				this.options.squareSize
			);

			this.ctx.shadowColor = "transparent";
			this.ctx.shadowBlur = 0;
		});

		// 绘制当前悬停的格子和食物
		for (
			let x = startX;
			x < this.canvas.width + this.options.squareSize;
			x += this.options.squareSize
		) {
			for (
				let y = startY;
				y < this.canvas.height + this.options.squareSize;
				y += this.options.squareSize
			) {
				const squareX = Math.round(
					x - (this.gridOffset.x % this.options.squareSize)
				);
				const squareY = Math.round(
					y - (this.gridOffset.y % this.options.squareSize)
				);
				const gridX = Math.floor((x - startX) / this.options.squareSize);
				const gridY = Math.floor((y - startY) / this.options.squareSize);

				// 绘制食物
				if (
					this.specialBlock &&
					gridX === this.specialBlock.x &&
					gridY === this.specialBlock.y
				) {
					this.ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
					this.ctx.shadowBlur = 20;
					this.ctx.fillStyle = this.specialBlock.color;
					this.ctx.fillRect(
						squareX,
						squareY,
						this.options.squareSize,
						this.options.squareSize
					);
					this.ctx.shadowColor = "transparent";
					this.ctx.shadowBlur = 0;
				}

				// 绘制当前悬停的格子（蛇头）
				if (
					this.hoveredSquare &&
					gridX === this.hoveredSquare.x &&
					gridY === this.hoveredSquare.y
				) {
					this.ctx.shadowColor = this.options.hoverShadowColor;
					this.ctx.shadowBlur = 15;
					this.ctx.shadowOffsetX = 0;
					this.ctx.shadowOffsetY = 0;

					const color = this.options.hoverFillColor.replace(
						"0.6",
						this.currentOpacity.toString()
					);
					this.ctx.fillStyle = color;
					this.ctx.fillRect(
						squareX,
						squareY,
						this.options.squareSize,
						this.options.squareSize
					);

					this.ctx.shadowColor = "transparent";
					this.ctx.shadowBlur = 0;
				}

				this.ctx.strokeStyle = this.options.borderColor;
				this.ctx.strokeRect(
					squareX,
					squareY,
					this.options.squareSize,
					this.options.squareSize
				);
			}
		}

		// 移动设备上重置坐标变换
		if (isPhone) {
			this.ctx.translate(-0.5, -0.5);
		}

		// 创建径向渐变来实现暗角效果
		const gradient = this.ctx.createRadialGradient(
			this.canvas.width / dpr / 2,
			this.canvas.height / dpr / 2,
			0,
			this.canvas.width / dpr / 2,
			this.canvas.height / dpr / 2,
			Math.sqrt(
				Math.pow(this.canvas.width / dpr, 2) +
					Math.pow(this.canvas.height / dpr, 2)
			) / 2
		);
		gradient.addColorStop(0, "rgba(6, 6, 6, 0)");
		gradient.addColorStop(1, "#060606");

		this.ctx.fillStyle = gradient;
		this.ctx.fillRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
	}

	updateAnimation(timestamp) {
		if (!this.lastTimestamp) {
			this.lastTimestamp = timestamp;
		}

		const deltaTime = timestamp - this.lastTimestamp;
		this.lastTimestamp = timestamp;

		// 更新透明度
		if (this.currentOpacity !== this.targetOpacity) {
			const progress = Math.min(deltaTime / this.options.transitionDuration, 1);
			this.currentOpacity =
				this.currentOpacity +
				(this.targetOpacity - this.currentOpacity) * progress;
		}

		// 更新痕迹格子的透明度
		for (const [key, square] of this.trailSquares) {
			square.opacity -= deltaTime / this.options.trailDuration;
			if (square.opacity <= 0) {
				this.trailSquares.delete(key);
			}
		}

		// 获取设备像素比
		const dpr = window.devicePixelRatio || 1;

		// 更新网格位置，为移动设备降低速度以减少闪烁
		const effectiveSpeed = Math.max(
			isPhone ? this.options.speed * 0.8 : this.options.speed,
			0
		);

		// 确保移动位置为整数值来避免子像素渲染导致的闪烁
		const moveAmount = isPhone
			? Math.round(effectiveSpeed * 100) / 100
			: effectiveSpeed;

		switch (this.options.direction) {
			case "right":
				this.gridOffset.x =
					(this.gridOffset.x - moveAmount + this.options.squareSize) %
					this.options.squareSize;
				break;
			case "left":
				this.gridOffset.x =
					(this.gridOffset.x + moveAmount + this.options.squareSize) %
					this.options.squareSize;
				break;
			case "up":
				this.gridOffset.y =
					(this.gridOffset.y + moveAmount + this.options.squareSize) %
					this.options.squareSize;
				break;
			case "down":
				this.gridOffset.y =
					(this.gridOffset.y - moveAmount + this.options.squareSize) %
					this.options.squareSize;
				break;
			case "diagonal":
				this.gridOffset.x =
					(this.gridOffset.x - moveAmount + this.options.squareSize) %
					this.options.squareSize;
				this.gridOffset.y =
					(this.gridOffset.y - moveAmount + this.options.squareSize) %
					this.options.squareSize;
				break;
		}

		// 检查食物是否移出屏幕
		if (this.specialBlock) {
			const startX =
				Math.floor(this.gridOffset.x / this.options.squareSize) *
				this.options.squareSize;
			const startY =
				Math.floor(this.gridOffset.y / this.options.squareSize) *
				this.options.squareSize;
			const foodX = Math.round(
				this.specialBlock.x * this.options.squareSize +
					startX -
					(this.gridOffset.x % this.options.squareSize)
			);
			const foodY = Math.round(
				this.specialBlock.y * this.options.squareSize +
					startY -
					(this.gridOffset.y % this.options.squareSize)
			);

			// 调整适用于设备像素比的边界检查
			if (
				foodX < -this.options.squareSize ||
				foodX > this.canvas.width / dpr ||
				foodY < -this.options.squareSize ||
				foodY > this.canvas.height / dpr
			) {
				// 食物移出屏幕时生成新的食物
				this.createSpecialBlock();
			}
		}

		this.drawGrid();
		this.animationFrame = requestAnimationFrame((timestamp) =>
			this.updateAnimation(timestamp)
		);
	}

	animate() {
		this.animationFrame = requestAnimationFrame((timestamp) =>
			this.updateAnimation(timestamp)
		);
	}

	handleVisibilityChange() {
		if (document[hiddenProperty]) {
			// 页面不可见时暂停动画
			if (this.animationFrame) {
				cancelAnimationFrame(this.animationFrame);
				this.animationFrame = null;
			}
		} else {
			// 页面重新可见时恢复动画
			if (!this.animationFrame) {
				this.lastTimestamp = 0; // 重置时间戳以防止大幅度更新
				this.animate();
			}
		}
	}

	destroy() {
		if (this.animationFrame) {
			cancelAnimationFrame(this.animationFrame);
		}
		window.removeEventListener("resize", () => this.resizeCanvas());
		this.canvas.removeEventListener("mousemove", (e) =>
			this.handleMouseMove(e)
		);
		this.canvas.removeEventListener("mouseleave", () =>
			this.handleMouseLeave()
		);

		// 移除触摸事件监听器
		if (isPhone && this.handleTouchStart) {
			this.canvas.removeEventListener("touchstart", this.handleTouchStart);
			this.canvas.removeEventListener("touchmove", this.handleTouchMoveEvent);
			this.canvas.removeEventListener("touchend", this.handleTouchEndEvent);
			this.canvas.removeEventListener("touchcancel", this.handleTouchCancel);
		}

		document.removeEventListener(
			visibilityChangeEvent,
			this.handleVisibilityChange.bind(this)
		);

		// 移除方向变化监听
		if (isPhone && window.orientation !== undefined) {
			window.removeEventListener("orientationchange", () => {});
		}
	}
}

window.hiddenProperty =
	"hidden" in document
		? "hidden"
		: "webkitHidden" in document
		? "webkitHidden"
		: "mozHidden" in document
		? "mozHidden"
		: null;

window.DIRECTIONS = {
	UP: "UP",
	DOWN: "DOWN",
	LEFT: "LEFT",
	RIGHT: "RIGHT",
	UNDIRECTED: "UNDIRECTED",
};
window.isPhone =
	/Mobile|Android|iOS|iPhone|iPad|iPod|Windows Phone|KFAPWI/i.test(
		navigator.userAgent
	);

function getMoveDirection(startx, starty, endx, endy) {
	if (!isPhone) {
		return;
	}

	const angx = endx - startx;
	const angy = endy - starty;

	if (Math.abs(angx) < 2 && Math.abs(angy) < 2) {
		return DIRECTIONS.UNDIRECTED;
	}

	const getAngle = (angx, angy) => (Math.atan2(angy, angx) * 180) / Math.PI;

	const angle = getAngle(angx, angy);
	if (angle >= -135 && angle <= -45) {
		return DIRECTIONS.UP;
	} else if (angle > 45 && angle < 135) {
		return DIRECTIONS.DOWN;
	} else if (
		(angle >= 135 && angle <= 180) ||
		(angle >= -180 && angle < -135)
	) {
		return DIRECTIONS.LEFT;
	} else if (angle >= -45 && angle <= 45) {
		return DIRECTIONS.RIGHT;
	}

	return DIRECTIONS.UNDIRECTED;
}

function loadIntro() {
	if (document[hiddenProperty] || loadIntro.loaded) {
		return;
	}

	setTimeout(() => {
		$(".wrap").classList.add("in");
		setTimeout(() => {
			$(".content-subtitle").innerHTML = `<span>${[...subtitle].join(
				"</span><span>"
			)}</span>`;
		}, 270);
	}, 0);
	loadIntro.loaded = true;
}

function switchPage() {
	if (switchPage.switched) {
		return;
	}
	const DOM = {
		intro: $(".content-intro"),
		path: $(".shape-wrap path"),
		shape: $("svg.shape"),
	};
	const cleanupIntroCanvas = () => {
		if (canvas) {
			cancelAnimationFrame(animationID);
			canvas.parentElement.removeChild(canvas);
			canvas = null;
		}
	};
	const hideIntroLayer = () => {
		DOM.intro.classList.add("is-hidden");
		DOM.intro.style.pointerEvents = "none";
	};
	DOM.shape.style.transformOrigin = "50% 0%";

	if (typeof anime !== "function") {
		DOM.intro.style.transform = "translateY(-200vh)";
		hideIntroLayer();
		cleanupIntroCanvas();
		switchPage.switched = true;
		return;
	}

	anime({
		targets: DOM.intro,
		duration: 1100,
		easing: "easeInOutSine",
		translateY: "-200vh",
		complete: hideIntroLayer,
	});

	anime({
		targets: DOM.shape,
		scaleY: [
			{
				value: [0.8, 1.8],
				duration: 550,
				easing: "easeInQuad",
			},
			{
				value: 1,
				duration: 550,
				easing: "easeOutQuad",
			},
		],
	});
	anime({
		targets: DOM.path,
		duration: 1100,
		easing: "easeOutQuad",
		d: DOM.path.getAttribute("pathdata:id"),
		complete: function (anim) {
			cleanupIntroCanvas();
		},
	});

	switchPage.switched = true;
}

function loadMain() {
	if (loadMain.loaded) {
		return;
	}
	setTimeout(() => {
		const workspacePanel = document.querySelector(".workspace-panel");
		if (workspacePanel) {
			workspacePanel.classList.add("in");
		}
		setTimeout(() => {
			const canvas = document.getElementById("gridCanvas");
			if (canvas) {
				const gridAnimation = new GridAnimation(canvas, {
					direction: "diagonal",
					speed: isPhone ? 0.03 : 0.05,
					borderColor: isPhone
						? "rgba(255, 255, 255, 0.2)"
						: "rgba(255, 255, 255, 0.1)",
					squareSize: isPhone ? 50 : 40,
					hoverFillColor: "rgba(255, 255, 255, 0.8)",
					hoverShadowColor: "rgba(255, 255, 255, 0.8)",
					transitionDuration: isPhone ? 150 : 200, // 移动端更快的过渡
					trailDuration: isPhone ? 2000 : 1500, // 移动端更长的痕迹
					specialBlockColor: "rgba(100, 255, 152, 0.8)",
					specialHoverColor: "rgba(29, 202, 29, 0.8)",
					// 蛇身颜色渐变配置
					snakeHeadColor: "rgba(255, 255, 255, 0.95)",
					snakeTailColor: "rgba(218, 231, 255, 0.25)",
					snakeColorDecay: 0.85, // 颜色衰减系数
					// 移动端特殊配置
					touchSensitivity: isPhone ? 1.2 : 1.0, // 触摸灵敏度
					vibrationEnabled: isPhone, // 是否启用震动反馈
				});
				gridAnimation.init();
			}
		}, 1100);
	}, 400);
	loadMain.loaded = true;
}

function loadAll() {
	if (loadAll.loaded) {
		return;
	}
	switchPage();
	loadMain();
	loadAll.loaded = true;
}

window.visibilityChangeEvent = hiddenProperty.replace(
	/hidden/i,
	"visibilitychange"
);
window.addEventListener(visibilityChangeEvent, loadIntro);
window.addEventListener("DOMContentLoaded", loadIntro);

const enterEl = $(".enter");
enterEl.addEventListener("click", loadAll);
enterEl.addEventListener("touchenter", loadAll);

function handleScrollEvent(e) {
	const deltaY = e.deltaY || e.wheelDelta * -1 || e.detail;
	if (deltaY > 0) {
		loadAll();
	}
}

document.body.addEventListener("wheel", handleScrollEvent, { passive: true });
document.body.addEventListener("mousewheel", handleScrollEvent, {
	passive: true,
});
document.body.addEventListener("DOMMouseScroll", handleScrollEvent, {
	passive: true,
}); // Firefox兼容
$(".arrow").addEventListener("mouseenter", loadAll);

if (isPhone) {
	document.addEventListener(
		"touchstart",
		function (e) {
			window.startx = e.touches[0].pageX;
			window.starty = e.touches[0].pageY;
		},
		{ passive: true }
	);
	document.addEventListener(
		"touchend",
		function (e) {
			let endx, endy;
			endx = e.changedTouches[0].pageX;
			endy = e.changedTouches[0].pageY;

			const direction = getMoveDirection(startx, starty, endx, endy);
			if (direction !== DIRECTIONS.UP) {
				return;
			}
			loadAll();
		},
		{ passive: true }
	);
}

const GISCUS_CONFIG = {
	repo: "junle-chen/ac-homepage",
	repoId: "R_kgDOS_DVDQ",
	category: "General",
	categoryId: "DIC_kwDOS_DVDc4C_djH",
	installed: true,
};

function normalizeStringList(value) {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.map((item) => String(item || "").trim())
		.filter(Boolean);
}

function uniqueList(values) {
	return Array.from(new Set((values || []).filter(Boolean)));
}

function createJunleRealtimeStore() {
	const config = window.JUNLE_REALTIME_CONFIG || {};
	const reactionTypes = ["daily_paper", "zotero_paper", "note_archive"];
	const state = {
		client: null,
		enabled: false,
		initialized: false,
		status: "Local mode",
		user: null,
		owner: false,
		memos: [],
		reactions: {
			daily_paper: [],
			zotero_paper: [],
			note_archive: [],
		},
	};
	const listeners = {};
	const subscriptions = {};
	let initPromise = null;

	function on(eventName, handler) {
		if (!listeners[eventName]) {
			listeners[eventName] = [];
		}
		listeners[eventName].push(handler);
		return () => {
			listeners[eventName] = (listeners[eventName] || []).filter((item) => item !== handler);
		};
	}

	function emit(eventName, detail) {
		(listeners[eventName] || []).forEach((handler) => {
			try {
				handler(detail);
			} catch (error) {
				// Realtime listeners should not break page rendering.
			}
		});
	}

	function isConfigured() {
		return Boolean(
			config.supabaseUrl &&
			config.supabaseAnonKey &&
			window.supabase &&
			window.supabase.createClient
		);
	}

	function getUserMetadata(user) {
		return user && user.user_metadata ? user.user_metadata : {};
	}

	function getGithubId(user) {
		const metadata = getUserMetadata(user);
		return String(metadata.provider_id || metadata.sub || metadata.user_id || "").trim();
	}

	function getGithubLogin(user) {
		const metadata = getUserMetadata(user);
		return String(
			metadata.user_name ||
			metadata.preferred_username ||
			metadata.nickname ||
			metadata.name ||
			""
		).trim().toLowerCase();
	}

	function isOwnerUser(user) {
		if (!user) {
			return false;
		}
		const ownerGithubIds = normalizeStringList(config.ownerGithubIds);
		const ownerGithubLogins = normalizeStringList(config.ownerGithubLogins).map((login) => login.toLowerCase());
		const githubId = getGithubId(user);
		const githubLogin = getGithubLogin(user);
		return (
			(ownerGithubIds.length && ownerGithubIds.indexOf(githubId) !== -1) ||
			(ownerGithubLogins.length && ownerGithubLogins.indexOf(githubLogin) !== -1)
		);
	}

	function getAuthState() {
		return {
			enabled: state.enabled,
			status: state.status,
			user: state.user,
			owner: state.owner,
			githubId: getGithubId(state.user),
			githubLogin: getGithubLogin(state.user),
		};
	}

	function updateAuth(user) {
		state.user = user || null;
		state.owner = isOwnerUser(state.user);
		if (!state.enabled) {
			state.status = "Local mode";
		} else if (!state.user) {
			state.status = "Live read-only";
		} else if (state.owner) {
			state.status = "Live owner";
		} else {
			state.status = "Signed in read-only";
		}
		emit("auth", getAuthState());
		if (typeof emitOwnerModeChange === "function") {
			emitOwnerModeChange(isOwnerModeEnabled());
		}
	}

	function mapMemoRow(row) {
		return {
			id: "remote-" + row.id,
			remoteId: row.id,
			title: row.title || "Memo",
			content: row.content || "",
			category: row.category || "live",
			date: row.created_at ? row.created_at.slice(0, 16).replace("T", " ") : "",
			priority: row.priority || "normal",
			source: "live",
		};
	}

	function init() {
		if (initPromise) {
			return initPromise;
		}
		initPromise = new Promise((resolve) => {
			if (!isConfigured()) {
				state.enabled = false;
				state.initialized = true;
				updateAuth(null);
				emit("ready", getAuthState());
				resolve(state);
				return;
			}
			state.enabled = true;
			state.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
			state.client.auth.onAuthStateChange((eventName, session) => {
				if (session) {
					scrubOAuthCallbackHash();
				}
				updateAuth(session && session.user ? session.user : null);
			});
			state.client.auth.getSession()
				.then((result) => {
					const session = result && result.data ? result.data.session : null;
					if (session) {
						scrubOAuthCallbackHash();
					}
					updateAuth(session && session.user ? session.user : null);
				})
				.catch(() => {
					updateAuth(null);
				})
				.finally(() => {
					state.initialized = true;
					emit("ready", getAuthState());
					resolve(state);
				});
		});
		return initPromise;
	}

	function ensureMemoSubscription() {
		if (!state.client || subscriptions.memos) {
			return;
		}
		subscriptions.memos = state.client
			.channel("homepage-site-memos")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "site_memos" },
				() => {
					loadMemos();
				}
			)
			.subscribe();
	}

	function ensureReactionSubscription(type) {
		if (!state.client || subscriptions["reaction:" + type]) {
			return;
		}
		subscriptions["reaction:" + type] = state.client
			.channel("homepage-site-reactions-" + type)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "site_reactions",
					filter: "item_type=eq." + type,
				},
				() => {
					loadReactions(type);
				}
			)
			.subscribe();
	}

	function loadMemos() {
		return init().then(() => {
			if (!state.enabled || !state.client) {
				return [];
			}
			ensureMemoSubscription();
			return state.client
				.from("site_memos")
				.select("*")
				.is("deleted_at", null)
				.order("created_at", { ascending: false })
				.then((result) => {
					if (result.error) {
						throw result.error;
					}
					state.memos = (result.data || []).map(mapMemoRow);
					emit("memos", state.memos.slice());
					return state.memos.slice();
				})
				.catch(() => []);
		});
	}

	function addMemo(memo) {
		return init().then(() => {
			if (!state.enabled || !state.client || !state.owner) {
				throw new Error("Realtime owner access is not available");
			}
			return state.client
				.from("site_memos")
				.insert({
					title: memo.title || "Memo",
					content: memo.content || "",
					category: memo.category || "live",
					priority: memo.priority || "normal",
					source: "live",
				})
				.select("*")
				.single()
				.then((result) => {
					if (result.error) {
						throw result.error;
					}
					return loadMemos().then(() => mapMemoRow(result.data));
				});
		});
	}

	function deleteMemo(remoteId) {
		return init().then(() => {
			if (!state.enabled || !state.client || !state.owner || !remoteId) {
				throw new Error("Realtime owner access is not available");
			}
			return state.client
				.from("site_memos")
				.delete()
				.eq("id", remoteId)
				.then((result) => {
					if (result.error) {
						throw result.error;
					}
					return loadMemos();
				});
		});
	}

	function loadReactions(type) {
		if (reactionTypes.indexOf(type) === -1) {
			return Promise.resolve([]);
		}
		return init().then(() => {
			if (!state.enabled || !state.client) {
				return [];
			}
			ensureReactionSubscription(type);
			return state.client
				.from("site_reactions")
				.select("item_key, active")
				.eq("item_type", type)
				.eq("active", true)
				.then((result) => {
					if (result.error) {
						throw result.error;
					}
					state.reactions[type] = uniqueList((result.data || []).map((row) => row.item_key));
					emit("reactions:" + type, state.reactions[type].slice());
					return state.reactions[type].slice();
				})
				.catch(() => []);
		});
	}

	function setReaction(type, itemKey, active) {
		return init().then(() => {
			if (!state.enabled || !state.client || !state.owner) {
				throw new Error("Realtime owner access is not available");
			}
			const previousKeys = (state.reactions[type] || []).slice();
			const nextKeys = new Set(state.reactions[type] || []);
			if (active) {
				nextKeys.add(itemKey);
			} else {
				nextKeys.delete(itemKey);
			}
			state.reactions[type] = Array.from(nextKeys);
			emit("reactions:" + type, state.reactions[type].slice());
			return state.client
				.from("site_reactions")
				.upsert(
					{
						item_type: type,
						item_key: itemKey,
						active: Boolean(active),
						updated_at: new Date().toISOString(),
					},
					{ onConflict: "item_type,item_key" }
				)
					.then((result) => {
						if (result.error) {
							throw result.error;
						}
						return loadReactions(type);
					})
					.catch((error) => {
						state.reactions[type] = previousKeys;
						emit("reactions:" + type, state.reactions[type].slice());
						emit("error", {
							action: "setReaction",
							type,
							itemKey,
							active: Boolean(active),
							message: error && error.message ? error.message : "Realtime sync failed",
						});
						throw error;
					});
			});
	}

	function signIn() {
		return init().then(() => {
			if (!state.enabled || !state.client) {
				return;
			}
			try {
				window.localStorage.setItem(POST_AUTH_HASH_STORAGE_KEY, getSafeCurrentHash("#memos"));
			} catch (error) {
				// Auth can proceed even if localStorage is unavailable.
			}
			return state.client.auth.signInWithOAuth({
				provider: "github",
				options: {
					redirectTo: config.redirectTo || window.location.href,
				},
			});
		});
	}

	function signOut() {
		return init().then(() => {
			if (!state.enabled || !state.client) {
				return;
			}
			return state.client.auth.signOut();
		});
	}

	return {
		init,
		on,
		signIn,
		signOut,
		loadMemos,
		addMemo,
		deleteMemo,
		loadReactions,
		setReaction,
		isEnabled: () => state.enabled,
		canWrite: () => Boolean(state.enabled && state.owner),
		getStatus: () => state.status,
		getAuthState,
	};
}

window.JunleRealtime = createJunleRealtimeStore();

const OWNER_STORAGE_KEY = "junle-homepage-owner-mode-v2";
const NOTE_ARCHIVE_STORAGE_KEY = "junle-homepage-archived-notes-v1";
const NOTE_VIEW_STORAGE_KEY = "junle-homepage-note-view-v2";
const POST_AUTH_HASH_STORAGE_KEY = "junle-homepage-post-auth-hash-v1";
const THEME_STORAGE_KEY = "junle-homepage-theme-v2";

function isRealtimeOwnerEnabled() {
	return Boolean(window.JunleRealtime && window.JunleRealtime.canWrite && window.JunleRealtime.canWrite());
}

function isOwnerModeEnabled() {
	return window.localStorage.getItem(OWNER_STORAGE_KEY) === "true" || isRealtimeOwnerEnabled();
}

function emitOwnerModeChange(ownerMode) {
	window.dispatchEvent(
		new CustomEvent("junle-owner-mode-change", {
			detail: { ownerMode },
		})
	);
}

function isNoteHash(hash) {
	return /^#note-\d+$/.test(hash || "");
}

function isAcademicHash(hash) {
	return ["#papers", "#daily-paper", "#paper-list"].indexOf(hash || "") !== -1;
}

function isOAuthCallbackHash(hash) {
	const value = String(hash || "");
	return (
		/^#(access_token|error|error_code|error_description)=/.test(value) ||
		value.indexOf("access_token=") !== -1 ||
		value.indexOf("refresh_token=") !== -1 ||
		value.indexOf("provider_token=") !== -1
	);
}

function isSafeAppHash(hash) {
	return (
		["#about", "#info", "#notes", "#memos", "#papers", "#daily-paper", "#paper-list", "#note-reader"].indexOf(hash || "") !== -1 ||
		isNoteHash(hash)
	);
}

function getStoredPostAuthHash() {
	try {
		const hash = window.localStorage.getItem(POST_AUTH_HASH_STORAGE_KEY);
		return isSafeAppHash(hash) ? hash : "#memos";
	} catch (error) {
		return "#memos";
	}
}

function getSafeCurrentHash(fallback = "#about") {
	const hash = window.location.hash;
	return isSafeAppHash(hash) ? hash : fallback;
}

function scrubOAuthCallbackHash() {
	if (!isOAuthCallbackHash(window.location.hash)) {
		return;
	}
	const nextHash = getStoredPostAuthHash();
	try {
		window.localStorage.removeItem(POST_AUTH_HASH_STORAGE_KEY);
	} catch (error) {
		// Clearing this hint is best-effort only.
	}
	window.history.replaceState(null, "", nextHash);
	if (typeof setWorkspaceView === "function") {
		loadAll();
		setWorkspaceView(nextHash, { introDelay: 0 });
		setTimeout(() => scrollMainToHash(getScrollTargetHash(nextHash)), 120);
	}
}

function getAcademicPanelName(hash) {
	return hash === "#paper-list" ? "paper-list" : "daily-paper";
}

function getScrollTargetHash(hash) {
	return isAcademicHash(hash) ? "#papers" : hash;
}

function getGiscusTheme() {
	const main = document.querySelector(".content-main");
	return main && main.classList.contains("theme-light") ? "light" : "dark";
}

function updateGiscusTheme() {
	const iframe = document.querySelector("iframe.giscus-frame");
	if (!iframe || !iframe.contentWindow) {
		return;
	}
	iframe.contentWindow.postMessage(
		{ giscus: { setConfig: { theme: getGiscusTheme() } } },
		"https://giscus.app"
	);
}

window.updateGiscusTheme = updateGiscusTheme;

function bindContentFilters() {
	const noteSearch = document.getElementById("noteSearch");
	const noteCards = Array.prototype.slice.call(
		document.querySelectorAll("[data-note-card]")
	);
	const noteEmpty = document.getElementById("noteEmptyState");
	const filterButtons = Array.prototype.slice.call(
		document.querySelectorAll("[data-filter-value]")
	);
	const archiveButtons = Array.prototype.slice.call(
		document.querySelectorAll("[data-note-archive]")
	);
	const noteCountLabel = document.querySelector("[data-note-count]");
	let activeFilter = "";
	let remoteArchivedNotes = [];

	if (!noteSearch || !noteCards.length) {
		return;
	}

	function getHaystack(card) {
		return [
			card.dataset.title,
			card.dataset.tags,
			card.dataset.category,
			card.dataset.excerpt,
		]
			.join(" ")
			.toLowerCase();
	}

	function getCardTags(card) {
		return String(card.dataset.tags || "")
			.split(/\s*\|\s*|\s*\/\s*|\s*,\s*/)
			.map((tag) => tag.trim().toLowerCase())
			.filter(Boolean);
	}

	function getNoteKey(card) {
		return card.dataset.noteKey || card.dataset.noteUrl || card.dataset.noteId || "";
	}

	function getStaticArchivedNotes() {
		return noteCards
			.filter((card) => card.dataset.noteArchived === "true")
			.map(getNoteKey)
			.filter(Boolean);
	}

	function isStaticArchived(key) {
		return getStaticArchivedNotes().indexOf(key) !== -1;
	}

	function readLocalArchivedNotes() {
		try {
			const value = JSON.parse(
				window.localStorage.getItem(NOTE_ARCHIVE_STORAGE_KEY)
			);
			return Array.isArray(value) ? value : [];
		} catch (error) {
			return [];
		}
	}

	function isRemoteArchiveSourceEnabled() {
		const realtimeConfig = window.JUNLE_REALTIME_CONFIG || {};
		return Boolean(
			window.JunleRealtime &&
			realtimeConfig.supabaseUrl &&
			realtimeConfig.supabaseAnonKey &&
			window.supabase &&
			window.supabase.createClient
		);
	}

	function readArchivedNotes() {
		const keys = new Set(getStaticArchivedNotes());
		if (!isRemoteArchiveSourceEnabled()) {
			readLocalArchivedNotes().forEach((key) => {
				if (key) {
					keys.add(key);
				}
			});
		}
		remoteArchivedNotes.forEach((key) => {
			if (key) {
				keys.add(key);
			}
		});
		return Array.from(keys);
	}

	function writeArchivedNotes(keys) {
		const staticKeys = new Set(getStaticArchivedNotes());
		window.localStorage.setItem(
			NOTE_ARCHIVE_STORAGE_KEY,
			JSON.stringify(keys.filter((key) => key && !staticKeys.has(key)))
		);
	}

	function isArchived(cardOrKey) {
		const key =
			typeof cardOrKey === "string" ? cardOrKey : getNoteKey(cardOrKey);
		return key ? readArchivedNotes().indexOf(key) !== -1 : false;
	}

	function matches(card, query, filter) {
		const haystack = getHaystack(card);
		const matchesQuery = !query || haystack.indexOf(query) !== -1;
		const normalizedFilter = String(filter || "").toLowerCase();
		const archiveMode = normalizedFilter === "__archive";
		const archived = isArchived(card);
		if (archiveMode) {
			return matchesQuery && archived;
		}
		if (archived) {
			return false;
		}
		const category = String(card.dataset.category || "").toLowerCase();
		const tags = getCardTags(card);
		const matchesFilter =
			!normalizedFilter ||
			category === normalizedFilter ||
			tags.indexOf(normalizedFilter) !== -1;
		return matchesQuery && matchesFilter;
	}

	function updateFilterButtons() {
		filterButtons.forEach((button) => {
			const value = button.dataset.filterValue || "";
			button.classList.toggle("is-active", value === activeFilter);
		});
	}

	function updateArchiveButtons() {
		const ownerMode = isOwnerModeEnabled();
		archiveButtons.forEach((button) => {
			const key = button.dataset.noteKey || "";
			const archived = isArchived(key);
			const staticArchived = isStaticArchived(key);
			button.hidden = !ownerMode;
			button.disabled = staticArchived;
			button.textContent = staticArchived ? "Archived" : archived ? "Restore" : "Archive";
			button.classList.toggle("is-archived", archived);
			button.setAttribute(
				"aria-label",
				staticArchived
					? "This note is archived in the deployed content"
					: archived
						? "Restore note from archive"
						: "Archive note"
			);
		});
	}

	function applyFilter() {
		const query = noteSearch.value.trim().toLowerCase();
		let visible = 0;
		noteCards.forEach((card) => {
			const matched = matches(card, query, activeFilter);
			const shell = card.closest("[data-note-shell]") || card;
			shell.hidden = !matched;
			shell.classList.toggle("is-hidden", !matched);
			card.hidden = false;
			card.classList.remove("is-hidden");
			if (matched) {
				visible += 1;
			}
		});
		if (noteEmpty) {
			noteEmpty.hidden = visible !== 0;
		}
		if (noteCountLabel) {
			const total = noteCountLabel.dataset.total || String(noteCards.length);
			noteCountLabel.textContent = `Showing ${visible} of ${total} posts`;
		}
		updateFilterButtons();
		updateArchiveButtons();
	}

	function setActiveFilter(value) {
		activeFilter = value || "";
		loadAll();
		setWorkspaceView("#notes");
		window.history.replaceState(null, "", "#notes");
		scrollMainToHash("#notes");
		applyFilter();
	}

	noteSearch.addEventListener("input", () => {
		if (noteSearch.value.trim()) {
			loadAll();
			setWorkspaceView("#notes");
			window.history.replaceState(null, "", "#notes");
		}
		applyFilter();
	});
	filterButtons.forEach((button) => {
		button.addEventListener("click", () => {
			const value = button.dataset.filterValue || "";
			setActiveFilter(value === activeFilter ? "" : value);
		});
	});
	archiveButtons.forEach((button) => {
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (!isOwnerModeEnabled()) {
				return;
			}
			const key = button.dataset.noteKey || "";
			if (!key) {
				return;
			}
			if (isStaticArchived(key)) {
				return;
			}
			const nextArchived = !isArchived(key);
			if (
				window.JunleRealtime &&
				window.JunleRealtime.isEnabled &&
				window.JunleRealtime.isEnabled() &&
				window.JunleRealtime.canWrite &&
				window.JunleRealtime.canWrite()
			) {
				window.JunleRealtime.setReaction("note_archive", key, nextArchived)
					.catch(() => {
						applyFilter();
					});
			} else {
				const archived = readArchivedNotes();
				const index = archived.indexOf(key);
				if (nextArchived && index === -1) {
					archived.push(key);
				} else if (!nextArchived && index !== -1) {
					archived.splice(index, 1);
				}
				writeArchivedNotes(archived);
				applyFilter();
			}
		});
	});
	if (window.JunleRealtime) {
		window.JunleRealtime.on("reactions:note_archive", (keys) => {
			remoteArchivedNotes = keys || [];
			applyFilter();
		});
		window.JunleRealtime.loadReactions("note_archive").then((keys) => {
			remoteArchivedNotes = keys || [];
			applyFilter();
		});
	}
	window.addEventListener("junle-owner-mode-change", applyFilter);
	window.addEventListener("storage", (event) => {
		if (
			event.key === OWNER_STORAGE_KEY ||
			event.key === NOTE_ARCHIVE_STORAGE_KEY
		) {
			applyFilter();
		}
	});
	applyFilter();
}

	function scrollMainToHash(hash) {
		if (!isSafeAppHash(hash)) {
			return;
		}
	const target = document.querySelector(hash);
	if (!target) {
		return;
	}
		target.scrollIntoView({ behavior: "smooth", block: "start" });
	}

	function clearAboutIntro(main) {
		if (clearAboutIntro.startTimer) {
			window.clearTimeout(clearAboutIntro.startTimer);
			clearAboutIntro.startTimer = null;
		}
		if (clearAboutIntro.timer) {
			window.clearTimeout(clearAboutIntro.timer);
			clearAboutIntro.timer = null;
		}
		main.classList.remove("about-intro-playing");
	}

	function playAboutIntro(main, delay = 0) {
		clearAboutIntro(main);
		const startIntro = () => {
			clearAboutIntro.startTimer = null;
			main.classList.add("about-intro-playing");
			clearAboutIntro.timer = window.setTimeout(() => {
				main.classList.remove("about-intro-playing");
				clearAboutIntro.timer = null;
			}, 200);
		};
		if (delay > 0) {
			clearAboutIntro.startTimer = window.setTimeout(startIntro, delay);
			return;
		}
		window.requestAnimationFrame(startIntro);
	}

	function setWorkspaceView(hash, options = {}) {
		const main = document.querySelector(".content-main");
		if (!main) {
			return;
		}
		const isMemoView = hash === "#memos";
		const isAcademicView = isAcademicHash(hash);
		const isAboutView = hash === "#about";
		const isInfoView = hash === "#info";
		const isNoteView = isNoteHash(hash);
		main.classList.toggle("view-memos", isMemoView);
		main.classList.toggle("view-academic", isAcademicView);
		main.classList.toggle("view-about", isAboutView);
		main.classList.toggle("view-info", isInfoView);
		main.classList.toggle("view-note", isNoteView);
		if (isAboutView) {
			playAboutIntro(main, options.introDelay || 0);
		} else {
			clearAboutIntro(main);
		}
			const academicPanel = getAcademicPanelName(hash);
			Array.prototype.slice
				.call(document.querySelectorAll("[data-academic-panel]"))
				.forEach((panel) => {
					const active = panel.dataset.academicPanel === academicPanel;
					panel.hidden = !active;
					panel.classList.toggle("is-active", active);
				});
			Array.prototype.slice
				.call(document.querySelectorAll(".topbar-nav a, .topbar-dropbtn"))
				.forEach((item) => {
					const href = item.getAttribute("href");
					const section = item.dataset.navSection || "";
				const active =
					href === hash ||
					(section === "blog" && (hash === "#notes" || isNoteView)) ||
					(section === "academic" && isAcademicView) ||
					(section === "info" && isInfoView) ||
					(section === "about" && isAboutView);
					item.classList.toggle("is-active", active);
				});
			Array.prototype.slice
				.call(document.querySelectorAll("[data-academic-nav]"))
				.forEach((item) => {
					const href = item.getAttribute("href");
					const active = href === `#${academicPanel}`;
					item.classList.toggle("is-active", active);
				});
	}

function bindLocalAnchors() {
	Array.prototype.slice
		.call(document.querySelectorAll('a[href^="#"]'))
		.forEach((link) => {
			link.addEventListener("click", (event) => {
				if (link.hasAttribute("data-note-open")) {
					return;
				}
				const hash = link.getAttribute("href");
				if (!hash || hash === "#") {
					return;
				}
				const isAcademicNav = link.hasAttribute("data-academic-nav");
				event.preventDefault();
				const wasLoaded = loadAll.loaded;
				loadAll();
				setWorkspaceView(hash, {
					introDelay: 0,
				});
				window.history.replaceState(null, "", hash);
				if (!isAcademicNav) {
					setTimeout(() => scrollMainToHash(getScrollTargetHash(hash)), 500);
				}
			});
		});
}

	function revealInitialHash() {
		if (!window.location.hash || window.location.hash === "#") {
			setWorkspaceView("#about");
			return;
		}
		const hash = window.location.hash;
		if (!isSafeAppHash(hash)) {
			loadAll();
			setWorkspaceView(isOAuthCallbackHash(hash) ? getStoredPostAuthHash() : "#about", {
				introDelay: 0,
			});
			return;
		}
		if (isNoteHash(hash) && window.openNoteByHash) {
			loadAll();
			window.openNoteByHash(hash, { updateHash: false });
			return;
		}
		const wasLoaded = loadAll.loaded;
		loadAll();
		setWorkspaceView(hash, {
			introDelay: 0,
		});
		setTimeout(() => scrollMainToHash(getScrollTargetHash(hash)), 1300);
	}

	function bindHashNavigation() {
		window.addEventListener("hashchange", () => {
			if (!window.location.hash || window.location.hash === "#") {
				if (window.closeNoteReader) {
					window.closeNoteReader({ setHash: false });
				}
				setWorkspaceView("#about");
				return;
			}
			const hash = window.location.hash;
			if (!isSafeAppHash(hash)) {
				setWorkspaceView(isOAuthCallbackHash(hash) ? getStoredPostAuthHash() : "#about", {
					introDelay: 0,
				});
				return;
			}
			if (isNoteHash(hash) && window.openNoteByHash) {
				loadAll();
				window.openNoteByHash(hash, { updateHash: false });
				return;
			}
			if (window.closeNoteReader) {
				window.closeNoteReader({ setHash: false });
			}
			const wasLoaded = loadAll.loaded;
			loadAll();
			setWorkspaceView(hash, {
				introDelay: 0,
			});
			setTimeout(() => scrollMainToHash(getScrollTargetHash(hash)), 120);
		});
	}

function bindThemeToggle() {
	const main = document.querySelector(".content-main");
	const button = document.querySelector("[data-theme-toggle]");
	const icon = document.querySelector("[data-theme-icon]");
	if (!main || !button || !icon) {
		return;
	}

	function applyTheme(theme) {
		const isLight = theme === "light";
		main.classList.toggle("theme-light", isLight);
		icon.textContent = isLight ? "☾" : "☀";
		button.setAttribute(
			"aria-label",
			isLight ? "Switch to dark mode" : "Switch to light mode"
		);
	}

	const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) || "light";
	applyTheme(savedTheme);

	button.addEventListener("click", () => {
		const nextTheme = main.classList.contains("theme-light") ? "dark" : "light";
		window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
		applyTheme(nextTheme);
		if (window.updateGiscusTheme) {
			window.updateGiscusTheme();
		}
	});
}

function bindGlassTopbar() {
	const main = document.querySelector(".content-main");
	const topbar = document.querySelector(".workspace-topbar");
	if (!main || !topbar) {
		return;
	}

	function updateGlassState() {
		main.classList.toggle("is-scrolled", main.scrollTop > 18);
	}

	main.addEventListener("scroll", updateGlassState, { passive: true });
	updateGlassState();
}

	function bindNoteViewToggle() {
		const feed = document.querySelector("[data-note-feed]");
		const buttons = Array.prototype.slice.call(
			document.querySelectorAll("[data-note-view]")
		);
	if (!feed || !buttons.length) {
		return;
	}

	function applyView(view) {
		const nextView = view === "image" ? "image" : "site";
		feed.classList.toggle("note-view-image", nextView === "image");
		feed.classList.toggle("note-view-site", nextView === "site");
		buttons.forEach((button) => {
			button.classList.toggle("is-active", button.dataset.noteView === nextView);
		});
		window.localStorage.setItem(NOTE_VIEW_STORAGE_KEY, nextView);
	}

	buttons.forEach((button) => {
		button.addEventListener("click", () => applyView(button.dataset.noteView));
	});
		applyView(window.localStorage.getItem(NOTE_VIEW_STORAGE_KEY) || "site");
	}

	function bindExternalDropdown() {
		const dropdowns = Array.prototype.slice.call(
			document.querySelectorAll("[data-topbar-dropdown]")
		);
		if (!dropdowns.length) {
			return;
		}

		function setOpen(dropdown, open) {
			const button = dropdown.querySelector("[data-dropdown-toggle]");
			dropdown.classList.toggle("is-open", open);
			if (button) {
				button.setAttribute("aria-expanded", open ? "true" : "false");
			}
		}

		dropdowns.forEach((dropdown) => {
			const button = dropdown.querySelector("[data-dropdown-toggle]");
			if (!button) {
				return;
			}
			button.addEventListener("click", (event) => {
				event.stopPropagation();
				const nextOpen = !dropdown.classList.contains("is-open");
				dropdowns.forEach((item) => setOpen(item, false));
				setOpen(dropdown, nextOpen);
			});
			Array.prototype.slice
				.call(dropdown.querySelectorAll("a"))
				.forEach((link) => {
					link.addEventListener("click", () => setOpen(dropdown, false));
				});
		});

		document.addEventListener("click", (event) => {
			dropdowns.forEach((dropdown) => {
				if (!dropdown.contains(event.target)) {
					setOpen(dropdown, false);
				}
			});
		});

		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape") {
				dropdowns.forEach((dropdown) => setOpen(dropdown, false));
			}
		});
	}

	function bindRealtimeAuthControls() {
		const loginButton = document.querySelector("[data-realtime-login]");
		const logoutButton = document.querySelector("[data-realtime-logout]");
		const statusNode = document.querySelector("[data-realtime-status]");
		const store = window.JunleRealtime;
		if (!store || !statusNode) {
			return;
		}
		let statusResetTimer = 0;

		function renderAuthState() {
			const auth = store.getAuthState();
			const enabled = store.isEnabled();
			statusNode.textContent = auth.status || store.getStatus();
			if (loginButton) {
				loginButton.hidden = !enabled || Boolean(auth.user);
			}
			if (logoutButton) {
				logoutButton.hidden = !enabled || !auth.user;
			}
		}
		function renderRealtimeError(error) {
			const message = error && error.message ? error.message : "Realtime sync failed";
			statusNode.textContent = "Sync failed: " + message;
			window.clearTimeout(statusResetTimer);
			statusResetTimer = window.setTimeout(renderAuthState, 5000);
		}

		if (loginButton) {
			loginButton.addEventListener("click", () => {
				store.signIn();
			});
		}
		if (logoutButton) {
			logoutButton.addEventListener("click", () => {
				store.signOut();
			});
		}
		store.on("auth", renderAuthState);
		store.on("ready", renderAuthState);
		store.on("error", renderRealtimeError);
		store.init().then(renderAuthState);
		renderAuthState();
	}

	function escapeHtml(value) {
		return String(value || "").replace(/[&<>"']/g, (char) => {
			const entities = {
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			};
			return entities[char] || char;
		});
	}

	function stripMarkdownFrontMatter(markdown) {
		return String(markdown || "").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
	}

	function slugifyHeading(text, usedIds) {
		const base =
			String(text || "")
				.toLowerCase()
				.replace(/<[^>]+>/g, "")
				.replace(/[^\w\u4e00-\u9fa5]+/g, "-")
				.replace(/^-+|-+$/g, "") || "section";
		let id = base;
		let index = 2;
		while (usedIds[id]) {
			id = `${base}-${index}`;
			index += 1;
		}
		usedIds[id] = true;
		return id;
	}

	function resolveMarkdownUrl(url, baseUrl) {
		const value = String(url || "").trim();
		if (!value || /^(https?:|mailto:|#|data:)/i.test(value)) {
			return value;
		}
		if (value.charAt(0) === "/") {
			return value;
		}
		const base = String(baseUrl || "").split("/").slice(0, -1).join("/");
		return base ? `${base}/${value}` : value;
	}

	function renderInlineMarkdown(text, baseUrl) {
		const mathSnippets = [];
		const codeSnippets = [];
		let html = String(text || "").replace(/`([^`]+)`/g, (_, code) => {
			const token = `@@CODE_${codeSnippets.length}@@`;
			codeSnippets.push(`<code>${escapeHtml(code)}</code>`);
			return token;
		});
		html = html.replace(
			/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^\s$](?:\\.|[^$\\])*?\$)/g,
			(match) => {
				const token = `@@MATH_${mathSnippets.length}@@`;
				mathSnippets.push(escapeHtml(match));
				return token;
			}
		);
		html = escapeHtml(html);
		html = html.replace(
			/!\[([^\]]*)\]\(([^)]+)\)/g,
			(_, alt, url) =>
				`<img src="${escapeHtml(resolveMarkdownUrl(url, baseUrl))}" alt="${escapeHtml(alt)}">`
		);
		html = html.replace(
			/\[([^\]]+)\]\(([^)]+)\)/g,
			(_, label, url) =>
				`<a href="${escapeHtml(resolveMarkdownUrl(url, baseUrl))}" target="_blank" rel="noopener noreferrer">${label}</a>`
		);
		html = html
			.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
			.replace(/\*([^*]+)\*/g, "<em>$1</em>");
		mathSnippets.forEach((snippet, index) => {
			html = html.replace(`@@MATH_${index}@@`, snippet);
		});
		codeSnippets.forEach((snippet, index) => {
			html = html.replace(`@@CODE_${index}@@`, snippet);
		});
		return html;
	}

	function renderStandaloneMath(line) {
		const trimmed = String(line || "").trim();
		if (!trimmed) {
			return "";
		}
		if (/^\$\$[\s\S]+\$\$$/.test(trimmed) || /^\\\[[\s\S]+\\\]$/.test(trimmed)) {
			return `<div class="math-block">${escapeHtml(trimmed)}</div>`;
		}
		if (/^\$(?!\$)[\s\S]+\$$/.test(trimmed) && /\\(?:begin|sum|frac|math|theta|left|right|log|mathbf|mathbb)|[_^{}]/.test(trimmed)) {
			return `<div class="math-block">$$${escapeHtml(trimmed.slice(1, -1))}$$</div>`;
		}
		return "";
	}

	function typesetMath(container) {
		if (!container || !window.MathJax) {
			return;
		}
		const run = () => {
			if (typeof window.MathJax.typesetClear === "function") {
				window.MathJax.typesetClear([container]);
			}
			if (typeof window.MathJax.typesetPromise === "function") {
				window.MathJax.typesetPromise([container]).catch(() => {});
				return;
			}
			if (typeof window.MathJax.typeset === "function") {
				try {
					window.MathJax.typeset([container]);
				} catch (error) {}
			}
		};
		if (window.MathJax.startup && window.MathJax.startup.promise) {
			window.MathJax.startup.promise.then(run).catch(() => {});
			return;
		}
		run();
	}

	function markdownToHtml(markdown, baseUrl) {
		const lines = stripMarkdownFrontMatter(markdown).split(/\r?\n/);
		const headings = [];
		const usedIds = {};
		const html = [];
		let paragraph = [];
		let list = null;
		let codeBlock = null;
		let tableRows = [];

		function flushParagraph() {
			if (!paragraph.length) {
				return;
			}
			html.push(`<p>${renderInlineMarkdown(paragraph.join(" "), baseUrl)}</p>`);
			paragraph = [];
		}

		function flushList() {
			if (!list) {
				return;
			}
			html.push(`<${list.type}>${list.items.map((item) => `<li>${renderInlineMarkdown(item, baseUrl)}</li>`).join("")}</${list.type}>`);
			list = null;
		}

		function flushTable() {
			if (!tableRows.length) {
				return;
			}
			const rows = tableRows
				.map((row) =>
					row
						.replace(/^\||\|$/g, "")
						.split("|")
						.map((cell) => cell.trim())
				)
				.filter((row) => row.length);
			const isDivider = (row) => row.every((cell) => /^:?-{3,}:?$/.test(cell));
			if (rows.length < 2 || !isDivider(rows[1])) {
				rows.forEach((row) => {
					html.push(`<p>${row.map((cell) => renderInlineMarkdown(cell, baseUrl)).join(" | ")}</p>`);
				});
				tableRows = [];
				return;
			}
			const header = rows[0];
			const bodyRows = rows.slice(2);
			html.push(
				`<table><thead><tr>${header
					.map((cell) => `<th>${renderInlineMarkdown(cell, baseUrl)}</th>`)
					.join("")}</tr></thead><tbody>${bodyRows
					.map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell, baseUrl)}</td>`).join("")}</tr>`)
					.join("")}</tbody></table>`
			);
			tableRows = [];
		}

		lines.forEach((rawLine) => {
			const line = rawLine.replace(/\s+$/, "");
			const fence = line.match(/^```(.*)$/);
			if (fence) {
				flushParagraph();
				flushList();
				flushTable();
				if (codeBlock) {
					html.push(`<pre><code>${escapeHtml(codeBlock.lines.join("\n"))}</code></pre>`);
					codeBlock = null;
				} else {
					codeBlock = { language: fence[1] || "", lines: [] };
				}
				return;
			}
			if (codeBlock) {
				codeBlock.lines.push(rawLine);
				return;
			}
			if (!line.trim()) {
				flushParagraph();
				flushList();
				flushTable();
				return;
			}
			const standaloneMath = renderStandaloneMath(line);
			if (standaloneMath) {
				flushParagraph();
				flushList();
				flushTable();
				html.push(standaloneMath);
				return;
			}
			if (/^\|.+\|$/.test(line)) {
				flushParagraph();
				flushList();
				tableRows.push(line);
				return;
			}
			flushTable();
			const heading = line.match(/^(#{1,4})\s+(.+)$/);
			if (heading) {
				flushParagraph();
				flushList();
				const level = Math.min(4, heading[1].length);
				const text = heading[2].trim();
				const id = slugifyHeading(text, usedIds);
				headings.push({ id, level, text });
				html.push(`<h${level} id="${id}">${renderInlineMarkdown(text, baseUrl)}</h${level}>`);
				return;
			}
			const quote = line.match(/^>\s+(.+)$/);
			if (quote) {
				flushParagraph();
				flushList();
				html.push(`<blockquote>${renderInlineMarkdown(quote[1], baseUrl)}</blockquote>`);
				return;
			}
			const unordered = line.match(/^\s*[-*]\s+(.+)$/);
			const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
			if (unordered || ordered) {
				flushParagraph();
				const type = unordered ? "ul" : "ol";
				if (!list || list.type !== type) {
					flushList();
					list = { type, items: [] };
				}
				list.items.push((unordered || ordered)[1]);
				return;
			}
			flushList();
			paragraph.push(line.trim());
		});

		flushParagraph();
		flushList();
		flushTable();
		if (codeBlock) {
			html.push(`<pre><code>${escapeHtml(codeBlock.lines.join("\n"))}</code></pre>`);
		}

		return {
			html: html.join(""),
			headings: headings.filter((heading) => heading.level > 1),
		};
	}

	function loadGiscus(host, term) {
		if (!host || !term) {
			return;
		}
		host.innerHTML = "";
		if (!GISCUS_CONFIG.installed) {
			const setup = document.createElement("div");
			setup.className = "giscus-setup-note";
			setup.innerHTML = [
				"<strong>Giscus comments need one GitHub setup step.</strong>",
				"<span>Install the Giscus GitHub App on <code>junle-chen/ac-homepage</code>, then copy the new repo/category IDs into <code>GISCUS_CONFIG</code>. Comments support Markdown through GitHub Discussions. After installation, enable <code>GISCUS_CONFIG.installed</code>.</span>",
				'<a href="https://github.com/apps/giscus" target="_blank" rel="noopener noreferrer">Install Giscus App</a>',
			].join("");
			host.appendChild(setup);
			return;
		}
		const loading = document.createElement("p");
		loading.className = "comment-note";
		loading.textContent = "Loading GitHub Discussions comments...";
		host.appendChild(loading);
		const script = document.createElement("script");
		script.src = "https://giscus.app/client.js";
		script.async = true;
		script.crossOrigin = "anonymous";
		script.setAttribute("data-repo", GISCUS_CONFIG.repo);
		script.setAttribute("data-repo-id", GISCUS_CONFIG.repoId);
		script.setAttribute("data-category", GISCUS_CONFIG.category);
		script.setAttribute("data-category-id", GISCUS_CONFIG.categoryId);
		script.setAttribute("data-mapping", "specific");
		script.setAttribute("data-term", term);
		script.setAttribute("data-strict", "0");
		script.setAttribute("data-reactions-enabled", "1");
		script.setAttribute("data-emit-metadata", "0");
		script.setAttribute("data-input-position", "bottom");
		script.setAttribute("data-theme", getGiscusTheme());
		script.setAttribute("data-lang", "zh-CN");
		script.addEventListener("load", () => {
			loading.remove();
		});
		script.addEventListener("error", () => {
			loading.textContent = "Giscus comments failed to load. Please check the repository installation and Discussions category.";
		});
		host.appendChild(script);
	}

	function bindNoteReader() {
		const reader = document.querySelector("[data-note-reader]");
		const cards = Array.prototype.slice.call(
			document.querySelectorAll("[data-note-open]")
		);
		if (!reader || !cards.length) {
			return;
		}
		const blogLayout = document.getElementById("notes");
		const body = reader.querySelector("[data-note-body]");
		const outline = reader.querySelector("[data-note-outline]");
		const image = reader.querySelector("[data-reader-image]");
		const title = reader.querySelector("[data-reader-title]");
		const excerpt = reader.querySelector("[data-reader-excerpt]");
		const date = reader.querySelector("[data-reader-date]");
		const category = reader.querySelector("[data-reader-category]");
		const readTime = reader.querySelector("[data-reader-read-time]");
		const tags = reader.querySelector("[data-reader-tags]");
		const giscusHost = reader.querySelector("[data-giscus-host]");
		const backButton = reader.querySelector("[data-note-back]");
		let activeRequest = 0;

		function renderOutline(headings) {
			outline.innerHTML = "";
			if (!headings.length) {
				const empty = document.createElement("p");
				empty.className = "empty-state";
				empty.textContent = "No outline";
				outline.appendChild(empty);
				return;
			}
			headings.forEach((heading) => {
				const link = document.createElement("a");
				link.href = `#${heading.id}`;
				link.className = `outline-level-${heading.level}`;
				link.textContent = heading.text;
				link.addEventListener("click", (event) => {
					event.preventDefault();
					const target = document.getElementById(heading.id);
					if (target) {
						target.scrollIntoView({ behavior: "smooth", block: "start" });
					}
				});
				outline.appendChild(link);
			});
		}

		function closeReader(options = {}) {
			reader.hidden = true;
			reader.classList.remove("is-open");
			if (blogLayout) {
				blogLayout.hidden = false;
			}
			if (giscusHost) {
				giscusHost.innerHTML = "";
			}
			if (options.setHash !== false) {
				window.history.replaceState(null, "", "#notes");
			}
			setWorkspaceView("#notes");
		}

		function openReader(card, options = {}) {
			const noteId = card.dataset.noteId;
			const noteUrl = card.dataset.noteUrl;
			const commentTerm = card.dataset.commentTerm || `note:${noteUrl}`;
			activeRequest += 1;
			const requestId = activeRequest;
			loadAll();
			reader.hidden = false;
			reader.classList.add("is-open");
			if (blogLayout) {
				blogLayout.hidden = true;
			}
			setWorkspaceView(`#${noteId}`);
			if (options.updateHash !== false) {
				window.history.replaceState(null, "", `#${noteId}`);
			}

			if (image) {
				const noteImage = card.dataset.noteImage || "";
				image.hidden = !noteImage;
				if (noteImage) {
					image.style.setProperty("--reader-image", `url("${noteImage}")`);
				} else {
					image.style.removeProperty("--reader-image");
				}
			}
			if (title) {
				title.textContent = card.dataset.title || "Untitled";
			}
			if (excerpt) {
				excerpt.textContent = card.dataset.excerpt || "";
				excerpt.hidden = !card.dataset.excerpt;
			}
			if (date) {
				date.textContent = card.dataset.date || "Undated";
			}
			if (category) {
				category.textContent = card.dataset.category || "Note";
			}
			if (readTime) {
				readTime.textContent = `${card.dataset.readTime || "3"} min read`;
			}
			if (tags) {
				tags.textContent = (card.dataset.tags || "").split("|").filter(Boolean).join(" / ");
				tags.hidden = !tags.textContent;
			}
			if (body) {
				body.innerHTML = '<p class="reader-loading">Loading note...</p>';
			}
			if (outline) {
				outline.innerHTML = "";
			}
			if (giscusHost) {
				giscusHost.innerHTML = "";
			}

			fetch(noteUrl, { cache: "no-store" })
				.then((response) => {
					if (!response.ok) {
						throw new Error("Note markdown missing");
					}
					return response.text();
				})
				.then((markdown) => {
					if (requestId !== activeRequest) {
						return;
					}
					const rendered = markdownToHtml(markdown, noteUrl);
					body.innerHTML = rendered.html || `<p>${escapeHtml(card.dataset.excerpt || "")}</p>`;
					renderOutline(rendered.headings);
					typesetMath(reader);
					loadGiscus(giscusHost, commentTerm);
				})
				.catch(() => {
					if (requestId !== activeRequest) {
						return;
					}
					body.innerHTML = `<p>${escapeHtml(card.dataset.excerpt || "This note could not be loaded.")}</p>`;
					renderOutline([]);
					typesetMath(reader);
					loadGiscus(giscusHost, commentTerm);
				});

			setTimeout(() => scrollMainToHash("#note-reader"), 80);
		}

		cards.forEach((card) => {
			card.addEventListener("click", (event) => {
				event.preventDefault();
				openReader(card);
			});
		});

		if (backButton) {
			backButton.addEventListener("click", () => {
				closeReader();
				setTimeout(() => scrollMainToHash("#notes"), 60);
			});
		}

		window.openNoteByHash = function (hash, options = {}) {
			const id = String(hash || "").replace(/^#/, "");
			const card = cards.find((item) => item.dataset.noteId === id);
			if (!card) {
				closeReader({ setHash: false });
				setWorkspaceView("#notes");
				return;
			}
			openReader(card, options);
		};
		window.closeNoteReader = closeReader;
	}

	function bindMemoManager() {
		const timeline = document.querySelector("[data-memo-timeline]");
		const form = document.querySelector("[data-memo-form]");
		const ownerButton = document.querySelector("[data-memo-owner]");
		const ownerInput = document.querySelector("[data-memo-owner-key]");
		const status = document.querySelector("[data-memo-status]");
		const datePreview = document.querySelector("[data-memo-date-preview]");
		if (!timeline || !form || !ownerButton || !ownerInput || !status) {
			return;
		}

		const STORAGE_KEY = "junle-homepage-memos";
		const OWNER_KEY_HASH = "7e6918fc06fb5179e913a7e058e762d89ccf981b5ba9660f53a026e747e9092a";
		const seedMemos = Array.prototype.slice
			.call(document.querySelectorAll("[data-memo-card]"))
			.map((entry) => ({
				id: entry.dataset.id,
				title: entry.dataset.title || "Memo",
				content: entry.dataset.content || "",
				category: entry.dataset.category || "general",
				date: entry.dataset.date || "",
				priority: entry.dataset.priority || "normal",
				source: entry.dataset.source || "imported",
				}));
			let ownerMode = window.localStorage.getItem(OWNER_STORAGE_KEY) === "true";
			let remoteMemos = [];

		function readState() {
			try {
				return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
			} catch (error) {
				return {};
			}
		}

			function writeState(state) {
				window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
			}

			function bufferToHex(buffer) {
				return Array.prototype.map
					.call(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, "0"))
					.join("");
			}

			function checkOwnerKey(key) {
				if (!window.crypto || !window.crypto.subtle || !window.TextEncoder) {
					return Promise.reject(new Error("Crypto unavailable"));
				}
				return window.crypto.subtle
					.digest("SHA-256", new TextEncoder().encode(key))
					.then((buffer) => bufferToHex(buffer) === OWNER_KEY_HASH);
			}

			function isRemoteMemoSourceConfigured() {
				const realtimeConfig = window.JUNLE_REALTIME_CONFIG || {};
				return Boolean(
					window.JunleRealtime &&
					realtimeConfig.supabaseUrl &&
					realtimeConfig.supabaseAnonKey &&
					window.supabase &&
					window.supabase.createClient
				);
			}

			function canSyncMemos() {
				return Boolean(
					window.JunleRealtime &&
					window.JunleRealtime.canWrite &&
					window.JunleRealtime.canWrite()
				);
			}

			function canUseLocalMemoStorage() {
				return !isRemoteMemoSourceConfigured();
			}

			function getRealtimeErrorMessage(error) {
				return error && error.message ? error.message : "Realtime sync failed";
			}

		function formatDate(date) {
			const pad = (value) => String(value).padStart(2, "0");
			return [
				date.getFullYear(),
				pad(date.getMonth() + 1),
				pad(date.getDate()),
			].join("-") + " " + [pad(date.getHours()), pad(date.getMinutes())].join(":");
		}

			function getVisibleMemos() {
				const state = readState();
				const deletedIds = state.deletedSeedIds || [];
				const localMemos = state.localMemos || [];
				return seedMemos
					.filter((memo) => deletedIds.indexOf(memo.id) === -1)
					.concat(remoteMemos)
					.concat(localMemos)
					.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
			}

		function createMemoEntry(memo) {
			const article = document.createElement("article");
			article.className = "memo-entry";
			article.dataset.memoCard = "";
			article.dataset.id = memo.id;
			article.dataset.remoteId = memo.remoteId || "";

			const dot = document.createElement("div");
			dot.className = "memo-entry-dot";
			dot.setAttribute("aria-hidden", "true");

			const body = document.createElement("div");
			body.className = "memo-entry-body";

			const meta = document.createElement("div");
			meta.className = "memo-entry-meta";
			[memo.date || "No date", memo.category || "general", memo.source || "local"].forEach((value) => {
				const span = document.createElement("span");
				span.textContent = value;
				meta.appendChild(span);
			});

			const title = document.createElement("h3");
			title.textContent = memo.title || "Memo";

			const content = document.createElement("p");
			content.textContent = memo.content || "Empty memo body.";
			if (!memo.content) {
				content.className = "muted";
			}

			const actions = document.createElement("div");
			actions.className = "memo-entry-actions";
			const priority = document.createElement("span");
			priority.textContent = memo.priority || "normal";
			actions.appendChild(priority);

			if (/^https?:\/\//.test(memo.content || "")) {
				const link = document.createElement("a");
				link.href = memo.content;
				link.target = "_blank";
				link.rel = "noopener noreferrer";
				link.textContent = "Open link";
				actions.appendChild(link);
			}

			const deleteButton = document.createElement("button");
			deleteButton.type = "button";
			deleteButton.className = "memo-delete";
			deleteButton.dataset.memoDelete = "";
			deleteButton.hidden = !ownerMode;
			deleteButton.textContent = "Delete";
			actions.appendChild(deleteButton);

			body.appendChild(meta);
			body.appendChild(title);
			body.appendChild(content);
			body.appendChild(actions);
			article.appendChild(dot);
			article.appendChild(body);
			return article;
		}

			function canDeleteMemo(memo) {
				return Boolean(
					ownerMode &&
					((memo.remoteId && canSyncMemos()) || (canUseLocalMemoStorage() && !memo.remoteId))
				);
			}

			function renderMemos() {
				const localOwnerMode = window.localStorage.getItem(OWNER_STORAGE_KEY) === "true";
				const realtimeOwnerMode = isRealtimeOwnerEnabled();
				const localFallbackMode = localOwnerMode && canUseLocalMemoStorage();
				ownerMode = localFallbackMode || realtimeOwnerMode;
				let memoStatus = "Locked";
				if (realtimeOwnerMode) {
					memoStatus = "GitHub owner";
				} else if (localFallbackMode) {
					memoStatus = "Owner unlocked";
				} else if (isRemoteMemoSourceConfigured()) {
					memoStatus = "GitHub owner required";
				}
				timeline.innerHTML = "";
				getVisibleMemos().forEach((memo) => {
					timeline.appendChild(createMemoEntry(memo));
				});
				form.hidden = !ownerMode;
				status.textContent = memoStatus;
				ownerButton.hidden = realtimeOwnerMode || isRemoteMemoSourceConfigured();
				ownerButton.textContent = localOwnerMode ? "Lock" : "Owner";
				ownerInput.hidden = ownerMode || isRemoteMemoSourceConfigured();
			Array.prototype.slice
				.call(document.querySelectorAll("[data-memo-delete]"))
				.forEach((button) => {
					const entry = button.closest("[data-memo-card]");
					const memo = entry
						? {
							id: entry.dataset.id || "",
							remoteId: entry.dataset.remoteId || "",
						}
						: {};
					button.hidden = !canDeleteMemo(memo);
				});
			if (datePreview) {
				datePreview.textContent = formatDate(new Date());
			}
			emitOwnerModeChange(ownerMode);
		}

			ownerButton.addEventListener("click", () => {
				if (ownerMode) {
					ownerMode = false;
					window.localStorage.removeItem(OWNER_STORAGE_KEY);
					renderMemos();
					return;
				}
				const key = ownerInput.value.trim();
				ownerButton.disabled = true;
				checkOwnerKey(key)
					.then((matches) => {
						if (matches) {
							ownerMode = true;
							window.localStorage.setItem(OWNER_STORAGE_KEY, "true");
							ownerInput.value = "";
							renderMemos();
							return;
						}
						status.textContent = "Owner key needed";
						ownerInput.focus();
					})
					.catch(() => {
						status.textContent = "Owner unlock requires HTTPS or localhost";
						ownerInput.focus();
					})
					.finally(() => {
						ownerButton.disabled = false;
					});
			});

			form.addEventListener("submit", (event) => {
				event.preventDefault();
				if (!ownerMode) {
					return;
				}
			const titleInput = form.elements.title;
			const contentInput = form.elements.content;
			const now = new Date();
			const date = formatDate(now);
			const content = contentInput.value.trim();
				if (!content && !titleInput.value.trim()) {
					return;
				}
				const memo = {
					id: "local-" + now.getTime(),
					title: titleInput.value.trim() || "Memo " + date.slice(0, 10),
					content,
					category: canSyncMemos() ? "live" : "local",
					date,
					priority: "normal",
					source: canSyncMemos() ? "live" : "local",
				};

				function saveLocalMemo() {
					const state = readState();
					const localMemos = state.localMemos || [];
					localMemos.push({
						...memo,
						category: "local",
						source: "local",
					});
					writeState({
						deletedSeedIds: state.deletedSeedIds || [],
						localMemos,
					});
					form.reset();
					renderMemos();
				}

				if (canSyncMemos()) {
					status.textContent = "Syncing memo";
					window.JunleRealtime.addMemo(memo)
						.then(() => {
							form.reset();
							status.textContent = "Memo synced";
							renderMemos();
						})
						.catch((error) => {
							status.textContent = "Sync failed: " + getRealtimeErrorMessage(error);
						});
					return;
				}
				if (!canUseLocalMemoStorage()) {
					status.textContent = "GitHub owner required";
					return;
				}
				saveLocalMemo();
			});

		timeline.addEventListener("click", (event) => {
			const deleteButton = event.target.closest("[data-memo-delete]");
			if (!deleteButton || !ownerMode) {
				return;
			}
				const entry = deleteButton.closest("[data-memo-card]");
				const id = entry ? entry.dataset.id : "";
				const remoteId = entry ? entry.dataset.remoteId : "";
				if (!id) {
					return;
				}
				if (
					remoteId &&
					canSyncMemos()
				) {
					status.textContent = "Deleting memo";
					window.JunleRealtime.deleteMemo(remoteId)
						.then(() => {
							status.textContent = "Memo deleted";
							renderMemos();
						})
						.catch(() => {
							status.textContent = "Delete failed";
					});
					return;
				}
				if (!canUseLocalMemoStorage()) {
					status.textContent = remoteId ? "GitHub owner required" : "Static memo requires content deploy";
					return;
				}
				const state = readState();
				const deletedSeedIds = state.deletedSeedIds || [];
				const localMemos = state.localMemos || [];
			if (id.indexOf("seed-") === 0 && deletedSeedIds.indexOf(id) === -1) {
				deletedSeedIds.push(id);
			}
			writeState({
				deletedSeedIds,
				localMemos: localMemos.filter((memo) => memo.id !== id),
			});
				renderMemos();
			});

			if (window.JunleRealtime) {
				window.JunleRealtime.on("auth", renderMemos);
				window.JunleRealtime.on("memos", (memos) => {
					remoteMemos = memos || [];
					renderMemos();
				});
				window.JunleRealtime.loadMemos().then((memos) => {
					remoteMemos = memos || [];
					renderMemos();
				});
			}
			renderMemos();
		}

	function bindDailyPapers() {
		const list = document.querySelector("[data-daily-paper-list]");
		const fullList = document.querySelector("[data-daily-paper-full]");
		const empty = document.querySelector("[data-daily-paper-empty]");
		const fullEmpty = document.querySelector("[data-daily-paper-full-empty]");
		const updated = document.querySelector("[data-daily-paper-updated]");
		const academicUpdated = document.querySelector("[data-academic-updated]");
		const dateInput = document.querySelector("[data-paper-date]");
		const dateClear = document.querySelector("[data-paper-date-clear]");
		const dateList = document.querySelector("[data-paper-date-list]");
		const sortButtons = Array.prototype.slice.call(document.querySelectorAll("[data-paper-sort]"));
		const dailyFilterBar = document.querySelector("[data-daily-paper-filter-bar]");
		const digestBox = document.querySelector("[data-daily-digest]");
		const digestCopy = document.querySelector("[data-digest-copy]");
		const digestStatus = document.querySelector("[data-digest-status]");
		const modal = document.querySelector("[data-paper-modal]");
		const modalTitle = document.querySelector("[data-paper-modal-title]");
		const modalAuthors = document.querySelector("[data-paper-modal-authors]");
		const modalCategories = document.querySelector("[data-paper-modal-categories]");
		const modalDate = document.querySelector("[data-paper-modal-date]");
		const modalSummary = document.querySelector("[data-paper-modal-summary]");
		const modalGrid = document.querySelector("[data-paper-modal-grid]");
		const modalExpanded = document.querySelector("[data-paper-modal-expanded]");
		const modalLinks = document.querySelector("[data-paper-modal-links]");
		const modalIndex = document.querySelector("[data-paper-modal-index]");
		const modalPosition = document.querySelector("[data-paper-modal-position]");
		const modalPrev = document.querySelector("[data-paper-modal-prev]");
		const modalNext = document.querySelector("[data-paper-modal-next]");
		const modalLimitations = document.querySelector("[data-paper-modal-limitations]");
		const modalLimitationsSection = document.querySelector("[data-paper-modal-limitations-section]");
		const modalCloseButtons = Array.prototype.slice.call(
			document.querySelectorAll("[data-paper-modal-close]")
		);
		if (modal) {
			const modalHost = document.querySelector(".content-main");
			if (modalHost && modal.parentElement !== modalHost) {
				modalHost.appendChild(modal);
			}
		}
		if (!list && !fullList) {
			return;
		}

		const SORT_STORAGE_KEY = "junle-homepage-daily-paper-sort";
		const DAILY_STAR_STORAGE_KEY = "junle-homepage-daily-paper-stars";
		const DAILY_DELETE_STORAGE_KEY = "junle-homepage-daily-paper-deleted-v1";
		const DAILY_DELETE_PREFIX = "deleted:";
		let allItems = [];
		let selectedDate = "";
		let datePageIndex = 0;
		let selectedCategory = "";
		let sortOrder = window.localStorage.getItem(SORT_STORAGE_KEY) || "desc";
		let starredDailyKeys = loadDailyStarredKeys();
		let remoteDailyStarredKeys = [];
		let deletedDailyKeys = loadDailyDeletedKeys();
		let remoteDailyDeletedKeys = [];
		let currentDigestText = "";
		let currentDailyData = null;
		let currentModalItems = [];
		let currentModalIndex = -1;

		const modalHighlightTerms = [
			"agentic RL",
			"Agentic RL",
			"GRPO",
			"RLOO",
			"EnvRL",
			"State Prediction",
			"Inverse Dynamics",
			"ALFWorld",
			"WebShop",
			"Qwen2.5",
			"LLM agent",
			"long-horizon",
			"multi-turn",
			"planning reliability",
			"policy optimization",
			"trajectory",
			"rollout",
			"benchmark",
			"agent planning",
			"稀疏奖励",
			"稀疏结果奖励",
			"环境动态",
			"环境反馈",
			"多轮交互",
			"长程",
			"状态理解",
			"动作可控性",
			"失败恢复",
			"消融",
			"实验",
		];

		function setEmpty(node, message, hidden) {
			if (node) {
				node.hidden = hidden;
				node.textContent = message;
			}
		}

		function setUpdatedLabel(data) {
			const label = data.digest && data.digest.title
				? data.digest.title
				: data.updated_at
					? "Updated " + data.updated_at
					: "arXiv agent feed";
			if (updated) {
				updated.textContent = label;
			}
			if (academicUpdated) {
				academicUpdated.textContent = label;
			}
		}

		function getPaperKey(paper) {
			return paper.id || paper.url || paper.title || "paper";
		}

		function loadDailyStarredKeys() {
			try {
				const value = JSON.parse(window.localStorage.getItem(DAILY_STAR_STORAGE_KEY) || "[]");
				return Array.isArray(value)
					? value.filter((key) => typeof key === "string" && key.indexOf(DAILY_DELETE_PREFIX) !== 0)
					: [];
			} catch (error) {
				return [];
			}
		}

		function saveDailyStarredKeys() {
			try {
				window.localStorage.setItem(DAILY_STAR_STORAGE_KEY, JSON.stringify(starredDailyKeys));
			} catch (error) {
				// Star state is a local reading aid; rendering should continue without storage.
			}
		}

		function getDailyStarredKeys() {
			return uniqueList(starredDailyKeys.concat(remoteDailyStarredKeys));
		}

		function loadDailyDeletedKeys() {
			try {
				const value = JSON.parse(window.localStorage.getItem(DAILY_DELETE_STORAGE_KEY) || "[]");
				return Array.isArray(value) ? value.filter((key) => typeof key === "string") : [];
			} catch (error) {
				return [];
			}
		}

		function saveDailyDeletedKeys() {
			try {
				window.localStorage.setItem(DAILY_DELETE_STORAGE_KEY, JSON.stringify(deletedDailyKeys));
			} catch (error) {
				// Delete state can still be carried by realtime when local storage is unavailable.
			}
		}

		function getDailyDeleteReactionKey(key) {
			return DAILY_DELETE_PREFIX + key;
		}

		function splitDailyReactionKeys(keys) {
			const starred = [];
			const deleted = [];
			(keys || []).forEach((key) => {
				if (typeof key !== "string") {
					return;
				}
				if (key.indexOf(DAILY_DELETE_PREFIX) === 0) {
					deleted.push(key.slice(DAILY_DELETE_PREFIX.length));
				} else {
					starred.push(key);
				}
			});
			return {
				starred: uniqueList(starred),
				deleted: uniqueList(deleted),
			};
		}

		function applyDailyReactionKeys(keys) {
			const reactionKeys = splitDailyReactionKeys(keys || []);
			remoteDailyStarredKeys = reactionKeys.starred;
			remoteDailyDeletedKeys = reactionKeys.deleted;
			renderDailyState();
		}

		function getDailyDeletedKeys() {
			return uniqueList(deletedDailyKeys.concat(remoteDailyDeletedKeys));
		}

		function isDailyDeleted(paper) {
			return getDailyDeletedKeys().indexOf(getPaperKey(paper)) !== -1;
		}

		function updateLocalDailyDeleteKey(key, deleted) {
			if (deleted && deletedDailyKeys.indexOf(key) === -1) {
				deletedDailyKeys = deletedDailyKeys.concat(key);
			} else if (!deleted) {
				deletedDailyKeys = deletedDailyKeys.filter((value) => value !== key);
			}
			saveDailyDeletedKeys();
		}

		function setDailyDeleted(paper, deleted) {
			const key = getPaperKey(paper);
			if (
				window.JunleRealtime &&
				window.JunleRealtime.isEnabled &&
				window.JunleRealtime.isEnabled() &&
				window.JunleRealtime.canWrite &&
				window.JunleRealtime.canWrite()
			) {
				window.JunleRealtime.setReaction("daily_paper", getDailyDeleteReactionKey(key), deleted)
					.catch(() => {
						updateLocalDailyDeleteKey(key, deleted);
						renderDailyState();
					});
				return;
			}
			updateLocalDailyDeleteKey(key, deleted);
		}

		function isDailyStarred(paper) {
			return getDailyStarredKeys().indexOf(getPaperKey(paper)) !== -1;
		}

		function toggleDailyStar(paper) {
			const key = getPaperKey(paper);
			const nextStarred = !isDailyStarred(paper);
			if (
				window.JunleRealtime &&
				window.JunleRealtime.isEnabled &&
				window.JunleRealtime.isEnabled() &&
				window.JunleRealtime.canWrite &&
				window.JunleRealtime.canWrite()
			) {
				window.JunleRealtime.setReaction("daily_paper", key, nextStarred)
					.catch(() => {
						renderFull();
					});
				return;
			}
			if (nextStarred) {
				starredDailyKeys = starredDailyKeys.concat(key);
			} else {
				starredDailyKeys = starredDailyKeys.filter((value) => value !== key);
			}
			saveDailyStarredKeys();
		}

		function compactText(text, maxLength = 260) {
			const value = String(text || "").replace(/\s+/g, " ").trim();
			if (value.length <= maxLength) {
				return value;
			}
			return `${value.slice(0, maxLength - 1).trim()}...`;
		}

		function escapeRegExp(value) {
			return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}

		function appendHighlightedText(node, text) {
			if (!node) {
				return;
			}
			const value = String(text || "");
			node.textContent = "";
			if (!value) {
				return;
			}
			const pattern = new RegExp(
				`(${modalHighlightTerms.map(escapeRegExp).join("|")})`,
				"gi"
			);
			let cursor = 0;
			value.replace(pattern, (match, _term, offset) => {
				if (offset > cursor) {
					node.appendChild(document.createTextNode(value.slice(cursor, offset)));
				}
				const strong = document.createElement("strong");
				strong.textContent = match;
				node.appendChild(strong);
				cursor = offset + match.length;
				return match;
			});
			if (cursor < value.length) {
				node.appendChild(document.createTextNode(value.slice(cursor)));
			}
		}

		function firstSentences(text, maxSentences = 1) {
			const sentences = String(text || "")
				.replace(/\s+/g, " ")
				.split(/(?<=[.!?。！？])\s*/)
				.map((sentence) => sentence.trim())
				.filter(Boolean);
			return sentences.slice(0, maxSentences).join(" ");
		}

		function firstClause(text, maxLength = 100) {
			const value = String(text || "").replace(/\s+/g, " ").trim();
			const clause = value.split(/[。！？.!?；;：:]/).find(Boolean) || value;
			return compactText(clause, maxLength);
		}

		function normalizePaperFocus(text) {
			return String(text || "")
				.replace(/^(这篇论文|本文|论文)(主要)?(针对|聚焦|试图解决|研究|讨论|提出)\s*/, "聚焦 ")
				.replace(/^(This paper|The paper)\s+(focuses on|studies|addresses|proposes)\s+/i, "聚焦 ")
				.trim();
		}

		function getPaperDate(paper) {
			return String(paper.report_date || paper.daily_report_date || paper.published || paper.updated || "").slice(0, 10);
		}

		function getArxivPdfUrl(paper) {
			const explicitPdf = (paper.pdf_url || "").replace(/^http:\/\//, "https://");
			if (explicitPdf) {
				return explicitPdf;
			}
			const url = (paper.arxiv_url || paper.paper_url || paper.url || "").replace(/^http:\/\//, "https://");
			const match = url.match(/arxiv\.org\/abs\/([^?#]+)/i);
			return match ? `https://arxiv.org/pdf/${match[1]}.pdf` : "";
		}

		function getRepoUrl(paper) {
			const brief = paper.brief || {};
			const explicit = paper.repo_url || brief.repo_url || paper.repository_url || paper.code_url || paper.github_url;
			if (explicit) {
				return explicit;
			}
			const source = [paper.summary || "", paper.url || "", paper.title || ""].join(" ");
			const match = source.match(/https?:\/\/(?:www\.)?(?:github\.com|gitlab\.com|huggingface\.co)\/[^\s),]+/i);
			return match ? match[0] : "";
		}

		function getAffiliations(paper) {
			const brief = paper.brief || {};
			const affiliations = brief.affiliations || paper.affiliations || paper.institutions || paper.organizations;
			if (Array.isArray(affiliations) && affiliations.length) {
				return affiliations.join("; ");
			}
			if (typeof affiliations === "string" && affiliations.trim()) {
				return affiliations;
			}
			return "arXiv metadata 未提供；需要打开 arXiv 页面或正文查看作者单位。";
		}

		function firstMatchingSentence(text, pattern) {
			const sentences = String(text || "")
				.replace(/\s+/g, " ")
				.split(/(?<=[.!?])\s+/)
				.filter(Boolean);
			return sentences.find((sentence) => pattern.test(sentence)) || "";
		}

		function choosePaperDetailText(...values) {
			return values
				.map((value) => String(value || "").trim())
				.filter(Boolean)
				.sort((a, b) => b.length - a.length)[0] || "";
		}

		function getPaperInterpretation(paper) {
			const brief = paper.brief || {};
			const analysis = paper.analysis || {};
			if (
				analysis.motivation ||
				analysis.method ||
				analysis.experiments ||
				analysis.insight ||
				analysis.research_help ||
				brief.motivation ||
				brief.method ||
				brief.experiments ||
				brief.insight ||
				brief.research_help
			) {
				return {
					"论文动机": choosePaperDetailText(brief.motivation, analysis.motivation) || "自动化还没有写入动机解读。",
					"方法": choosePaperDetailText(brief.method, analysis.method) || "自动化还没有写入方法解读。",
					"实验结果": choosePaperDetailText(brief.experiments, analysis.experiments) || "自动化还没有写入实验结果解读。",
					"Insight": choosePaperDetailText(brief.insight, analysis.insight, brief.research_help, analysis.research_help) || "自动化还没有写入 insight。",
				};
			}
			const title = paper.title || "Untitled paper";
			const summary = paper.summary || "";
			const source = `${title} ${summary}`.toLowerCase();
			const methodSentence = firstMatchingSentence(
				summary,
				/\b(propose|introduce|present|framework|method|model|algorithm|tree search|reinforcement|optimization|training|agent)\b/i
			);
			const experimentSentence = firstMatchingSentence(
				summary,
				/\b(experiment|benchmark|result|outperform|achieve|demonstrate|evaluate|success|accuracy|score|validated)\b/i
			);
			const motivation = /sparse|long[- ]?horizon|complex|challeng|struggle/.test(source)
				? "动机是解决长程 agent 任务中的稀疏反馈、复杂交互或规划可靠性问题。"
				: "动机是把当前方法推进到更接近真实 agent 工作流的任务设定。";
			const method = methodSentence
				? "摘要显示方法包含新的 agent 框架、训练策略或评测协议；需要结合正文确认具体模块。"
				: "方法需要进一步读正文确认；从标题和摘要看，核心是围绕 agent 训练、规划、工具使用或评测构建新的框架。";
			const experiments = experimentSentence
				? "摘要显示有实验或 benchmark 对比；精读时应检查 baseline、ablation、失败案例和统计口径。"
				: "摘要没有给出明确实验数字；需要打开论文正文查看 benchmark、baseline 和 ablation。";
			let researchHelp = "可作为 Daily Paper 候选，优先检查任务定义、评测协议、失败案例和可复现资源。";
			if (/agentic|reinforcement|rl\b|reward|grpo/.test(source)) {
				researchHelp = "对 agentic RL 研究有帮助：重点看奖励设计、trajectory 采样、环境反馈和 policy optimization 的接口。";
			}
			if (/multi[- ]?turn|dialog|interactive|interaction/.test(source)) {
				researchHelp = "对多轮 agent 研究有帮助：重点看状态保持、用户偏好延续、澄清机制和跨轮评测。";
			}
			if (/long[- ]?horizon|planning|planner|plan/.test(source)) {
				researchHelp = "对 long-horizon planning 有帮助：重点看任务分解、搜索/回溯、失败恢复和子目标评估。";
			}
			if (/memory|stateful|personalized|preference/.test(source)) {
				researchHelp = "对 agent memory 有帮助：重点看记忆写入、检索、更新和个性化状态如何进入规划过程。";
			}
			return {
				"论文动机": motivation,
				"方法": method,
				"实验结果": experiments,
				"Insight": researchHelp,
			};
		}

		function getPaperCardSummary(paper) {
			const brief = paper.brief || {};
			const analysis = paper.analysis || {};
			const direct =
				analysis.card_summary ||
				brief.card_summary ||
				paper.card_summary ||
				brief.tldr ||
				paper.tldr;
			if (direct) {
				return compactText(direct, 190);
			}
			const motivation = normalizePaperFocus(firstClause(analysis.motivation || brief.motivation, 96));
			const method = firstClause(analysis.method || brief.method, 88);
			if (motivation && method) {
				return compactText(`${motivation}。方法上，${method}。`, 190);
			}
			if (motivation) {
				return compactText(`${motivation}。`, 170);
			}
			const recommendation = getRecommendation(paper);
			return compactText(
				brief.summary ||
					paper.summary ||
					recommendation.reason ||
					recommendation.judgement ||
					"这篇论文还没有自动生成短概括。",
				190
			);
		}

		function getPaperModalSummary(paper) {
			const brief = paper.brief || {};
			const analysis = paper.analysis || {};
			return compactText(
				analysis.full_summary ||
					brief.full_summary ||
					brief.summary_zh ||
					analysis.card_summary ||
					brief.card_summary ||
					brief.summary ||
					paper.summary ||
					getPaperCardSummary(paper),
				720
			);
		}

		function getPaperAbstractText(paper) {
			const brief = paper.brief || {};
			const analysis = paper.analysis || {};
			return compactText(
				analysis.abstract_zh ||
					brief.abstract_zh ||
					brief.summary_zh ||
					brief.summary ||
					analysis.full_summary ||
					brief.full_summary ||
					getPaperModalSummary(paper),
				900
			);
		}

		function getPaperTakeawayText(paper) {
			const brief = paper.brief || {};
			const recommendation = getRecommendation(paper);
			const values = [
				getContribution(paper),
				recommendation.judgement,
				recommendation.reason,
			];
			const highlights = Array.isArray(brief.highlights) ? brief.highlights : [brief.highlights];
			highlights.forEach((item) => values.push(item));
			const seen = new Set();
			const rows = values
				.map((item) => String(item || "").replace(/^[-•]\s*/, "").trim())
				.filter(Boolean)
				.filter((item) => {
					const key = item.replace(/\s+/g, " ").replace(/[。；;]+$/g, "").toLowerCase();
					if (seen.has(key)) {
						return false;
					}
					seen.add(key);
					return true;
				});
			if (!rows.length) {
				return "";
			}
			return rows.length === 1 ? rows[0] : rows.map((item) => `• ${item}`).join("\n");
		}

		function formatAuthors(authors) {
			if (Array.isArray(authors) && authors.length) {
				return authors.join(", ");
			}
			return String(authors || "N/A");
		}

		function normalizeModalValue(value) {
			if (Array.isArray(value)) {
				return value
					.map((item) => String(item || "").trim())
					.filter(Boolean)
					.map((item) => `• ${item}`)
					.join("\n");
			}
			return String(value || "").trim();
		}

		function createModalSection(label, value) {
			const section = document.createElement("section");
			section.className = "paper-modal-detail-card";
			const heading = document.createElement("h4");
			heading.textContent = label;
			const body = document.createElement("p");
			appendHighlightedText(body, normalizeModalValue(value) || "自动化还没有写入这一部分。");
			section.appendChild(heading);
			section.appendChild(body);
			return section;
		}

		function appendModalSection(parent, label, value) {
			const normalized = normalizeModalValue(value);
			if (parent && normalized) {
				parent.appendChild(createModalSection(label, normalized));
			}
		}

		function createModalLink(label, href) {
			if (!href) {
				return null;
			}
			const link = document.createElement("a");
			link.href = href;
			link.target = "_blank";
			link.rel = "noopener noreferrer";
			link.textContent = label;
			return link;
		}

		function closePaperModal() {
			if (!modal) {
				return;
			}
			modal.hidden = true;
			modal.classList.remove("is-open");
			document.body.classList.remove("paper-modal-open");
			currentModalIndex = -1;
		}

		function syncModalNavigation(total) {
			[modalPrev, modalNext].forEach((button) => {
				if (button) {
					button.disabled = total < 2;
				}
			});
		}

		function openModalByOffset(offset) {
			if (!currentModalItems.length || currentModalIndex < 0) {
				return;
			}
			const total = currentModalItems.length;
			const nextIndex = (currentModalIndex + offset + total) % total;
			openPaperModal(currentModalItems[nextIndex], nextIndex, total);
		}

		function openPaperModal(paper, index, total, items) {
			if (!modal) {
				return;
			}
			if (Array.isArray(items)) {
				currentModalItems = items;
			}
			const modalTotal = total || currentModalItems.length || 1;
			currentModalIndex = index;
			const brief = paper.brief || {};
			const analysis = paper.analysis || {};
			const interpretation = getPaperInterpretation(paper);
			const authors = formatAuthors(paper.authors || brief.authors);
			const categories = (paper.categories || [paper.primary_category]).filter(Boolean).join(", ");
			const repoUrl = getRepoUrl(paper);
			const projectUrl = paper.project_url || brief.project_url || "";
			const arxivUrl = (paper.arxiv_url || paper.paper_url || paper.url || "").replace(/^http:\/\//, "https://");
			const paperLinkLabel = /arxiv\.org/i.test(arxivUrl) ? "arXiv" : "Paper";
			const pdfUrl = getArxivPdfUrl(paper);

			if (modalTitle) {
				modalTitle.textContent = paper.title || "Untitled paper";
			}
			if (modalAuthors) {
				modalAuthors.textContent = `Authors: ${authors}`;
			}
			if (modalCategories) {
				modalCategories.textContent = `Categories: ${categories || "N/A"}`;
			}
			if (modalDate) {
				modalDate.textContent = `Date: ${getPaperDate(paper) || "N/A"}`;
			}
			if (modalSummary) {
				appendHighlightedText(modalSummary, getPaperModalSummary(paper));
			}
			if (modalIndex) {
				modalIndex.textContent = String(index + 1);
			}
			if (modalPosition) {
				modalPosition.textContent = `${index + 1} / ${modalTotal}`;
			}
			if (modalGrid) {
				modalGrid.innerHTML = "";
				[
					["Motivation", interpretation["论文动机"]],
					["Method", interpretation["方法"]],
					["Result", interpretation["实验结果"]],
					["Insight", interpretation["Insight"]],
				].forEach(([label, value]) => {
					modalGrid.appendChild(createModalSection(label, value));
				});
			}
			if (modalExpanded) {
				modalExpanded.innerHTML = "";
				appendModalSection(modalExpanded, "摘要", getPaperAbstractText(paper));
				appendModalSection(modalExpanded, "推荐与贡献", getPaperTakeawayText(paper));
			}
			if (modalLimitations && modalLimitationsSection) {
				const limitations = normalizeModalValue(analysis.limitations || brief.limitations);
				appendHighlightedText(modalLimitations, limitations || "");
				modalLimitationsSection.hidden = !limitations;
			}
			if (modalLinks) {
				modalLinks.innerHTML = "";
				[
					createModalLink(paperLinkLabel, arxivUrl),
					createModalLink("PDF", pdfUrl),
					createModalLink("Code", repoUrl),
					createModalLink("Project", projectUrl),
				]
					.filter(Boolean)
					.forEach((link) => modalLinks.appendChild(link));
			}

			modal.hidden = false;
			modal.classList.add("is-open");
			modal.dataset.paperKey = getPaperKey(paper);
			syncModalNavigation(modalTotal);
			document.body.classList.add("paper-modal-open");
			const closeButton = modal.querySelector(".paper-modal-close");
			if (closeButton) {
				closeButton.focus();
			}
		}

		function getPaperTags(paper) {
			const rawSource = [
				paper.title || "",
				paper.summary || "",
				paper.brief && paper.brief.summary,
				(paper.categories || []).join(" "),
			].join(" ").toLowerCase();
			const isOffTopicDomain = /antimicrobial|peptide|wireless network|low-altitude|vector database|sponsored search|ad description|autonomous driving/.test(rawSource);
			if (isOffTopicDomain) {
				return [];
			}
			const signals = Object.assign(
				{},
				(paper.recommendation && paper.recommendation.signals) || {},
				(paper.brief && paper.brief.recommendation && paper.brief.recommendation.signals) || {}
			);
			const llmOrAgentContext = /llm|large language model|language model|coding agent|research agent|agentic large language|openclaw|qwen|webshop|alfworld|grpo|rloo/.test(rawSource);
			const tags = [];
			if (signals.agenticRl || /agentic reinforcement learning|agentic rl|llm policy optimization|policy optimization|grpo|rloo|hindsight-informed memory policy optimization/.test(rawSource)) {
				tags.push("agentic rl");
			}
			if (signals.multiTurn || (/multi[- ]turn|turn-level|interactive replanning|multi-round/.test(rawSource) && llmOrAgentContext)) {
				tags.push("multi-turn");
			}
			if (signals.longHorizon || (/long[- ]horizon|multi[- ]step|multi-step reasoning/.test(rawSource) && llmOrAgentContext)) {
				tags.push("long horizon");
			}
			if (
				signals.agentPlanning ||
				((signals.reliability || signals.memory) && signals.longHorizon) ||
				/agent planning|planning agent|llm planning|multi-agent llm planning|joint plan tensor|coding agent|research agents?|tool use|skill tree search|skill construction|orchestrat\w*.*llm|expert llms/.test(rawSource)
			) {
				tags.push("agent planning");
			}
			return tags.filter((tag, index) => tags.indexOf(tag) === index);
		}

		function isDailyPaperRelevant(paper) {
			return getPaperTags(paper).length > 0;
		}

		function getRelevantDailyItems() {
			return allItems.filter((paper) => isDailyPaperRelevant(paper) && !isDailyDeleted(paper));
		}

		function getDeletedDailyItems() {
			return allItems.filter((paper) => isDailyPaperRelevant(paper) && isDailyDeleted(paper));
		}

		function getContribution(paper) {
			if (paper.brief && paper.brief.contribution) {
				return paper.brief.contribution;
			}
			const source = [paper.title || "", paper.summary || ""].join(" ").toLowerCase();
			const contributions = [];
			if (/reinforcement|rl\b|grpo|reward/.test(source)) {
				contributions.push("围绕 agentic RL 训练，关注奖励信号、环境交互和策略改进");
			}
			if (/long[- ]?horizon|multi[- ]?step|planning|planner|plan/.test(source)) {
				contributions.push("面向长程任务规划，适合检查任务分解、失败恢复和跨步骤一致性");
			}
			if (/multi[- ]?turn|dialog|interactive|interaction/.test(source)) {
				contributions.push("涉及多轮交互或动态环境，需要重点看状态保持和交互协议");
			}
			if (/memory|stateful|personalized|preference/.test(source)) {
				contributions.push("与 agent memory、个性化状态或偏好延续相关");
			}
			if (/benchmark|dataset|evaluation|eval/.test(source)) {
				contributions.push("提供或使用评测基准，可用于对比 planning agent 的可靠性");
			}
			if (/skill|tool/.test(source)) {
				contributions.push("关注工具使用或技能构建，可能适合纳入 reusable agent workflow");
			}
			if (!contributions.length) {
				contributions.push("作为候选论文，先检查问题设定、方法模块、实验任务和是否可复现");
			}
			return contributions.join("；") + "。";
		}

		function getRecommendation(paper) {
			const explicit = paper.recommendation || (paper.brief && paper.brief.recommendation);
			if (explicit) {
				const explicitLevel = explicit.level || explicit.value_level || (
					explicit.score >= 78 ? "高" : explicit.score >= 58 ? "中" : "低"
				);
				return {
					score: explicit.score || 0,
					level: explicitLevel,
					label: explicit.label || "待评估",
					waterRisk: explicit.water_risk || explicit.waterRisk || "未知",
					judgement: explicit.value_judgement || explicit.judgement || "自动化还没有写入价值判断。",
					reason: explicit.reason || "",
				};
			}
			const source = [paper.title || "", paper.summary || ""].join(" ").toLowerCase();
			let score = 36;
			if (/agentic|reinforcement|rl\b|grpo|ppo|reward/.test(source)) {
				score += 18;
			}
			if (/multi[- ]?turn|dialog|interactive|replanning/.test(source)) {
				score += 16;
			}
			if (/long[- ]?horizon|planning|planner|multi[- ]?step/.test(source)) {
				score += 16;
			}
			if (/memory|stateful|personalized|preference/.test(source)) {
				score += 12;
			}
			if (/experiment|benchmark|outperform|success|baseline|ablation/.test(source)) {
				score += 10;
			} else {
				score -= 8;
			}
			if (getRepoUrl(paper)) {
				score += 8;
			}
			score = Math.max(10, Math.min(98, score));
			const label = score >= 85 ? "强烈推荐" : score >= 70 ? "值得读" : score >= 55 ? "可略读" : "暂不优先";
			const waterRisk = score >= 78 ? "低" : score >= 58 ? "中" : "高";
			const level = score >= 78 ? "高" : score >= 58 ? "中" : "低";
			const judgement = waterRisk === "低"
				? "有价值：优先进入今日精读候选。"
				: waterRisk === "中"
					? "需要谨慎：先看实验和设定是否扎实。"
					: "可能偏水：主题或实验信号偏弱，不优先。";
			return {
				score,
				level,
				label,
				waterRisk,
				judgement,
				reason: "基于标题、摘要、实验信号、代码信号和研究主题相关度的自动化初筛。",
			};
		}

		function setSortButtonState() {
			sortButtons.forEach((button) => {
				button.classList.toggle("is-active", button.dataset.paperSort === sortOrder);
			});
		}

		function normalizeFilterValue(value) {
			return String(value || "").trim().toLowerCase();
		}

		function paperInDailyCategory(paper, category) {
			if (!category) {
				return true;
			}
			if (category === "__starred") {
				return isDailyStarred(paper);
			}
			if (category === "__deleted") {
				return isOwnerModeEnabled() && isDailyDeleted(paper);
			}
			const normalized = normalizeFilterValue(category);
			return getPaperTags(paper).some((tag) => normalizeFilterValue(tag) === normalized);
		}

		function getDateFilteredItems() {
			const sourceItems = selectedCategory === "__deleted" && isOwnerModeEnabled()
				? getDeletedDailyItems()
				: getRelevantDailyItems();
			return sourceItems.filter((paper) => !selectedDate || getPaperDate(paper) === selectedDate);
		}

		function getFilteredItems() {
			return getDateFilteredItems()
				.filter((paper) => paperInDailyCategory(paper, selectedCategory))
				.sort((a, b) => {
					const starCompare = Number(isDailyStarred(b)) - Number(isDailyStarred(a));
					if (starCompare !== 0) {
						return starCompare;
					}
					const dateCompare = String(getPaperDate(a)).localeCompare(String(getPaperDate(b)));
					if (dateCompare !== 0) {
						return sortOrder === "asc" ? dateCompare : -dateCompare;
					}
					return String(a.title || "").localeCompare(String(b.title || ""));
				});
		}

		function renderDailyFilters() {
			if (!dailyFilterBar) {
				return;
			}
			const sourceItems = getRelevantDailyItems()
				.filter((paper) => !selectedDate || getPaperDate(paper) === selectedDate);
			const deletedItems = getDeletedDailyItems()
				.filter((paper) => !selectedDate || getPaperDate(paper) === selectedDate);
			const counts = new Map();
			sourceItems.forEach((paper) => {
				getPaperTags(paper).forEach((tag) => {
					counts.set(tag, (counts.get(tag) || 0) + 1);
				});
			});
			const options = [
				{ name: "", label: "All", count: sourceItems.length },
				{ name: "__starred", label: "Star", count: sourceItems.filter(isDailyStarred).length },
				...Array.from(counts.entries())
					.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
					.map(([name, count]) => ({ name, label: name, count })),
			];
			if (isOwnerModeEnabled() && deletedItems.length) {
				options.splice(2, 0, { name: "__deleted", label: "Deleted", count: deletedItems.length });
			}
			if (selectedCategory && !options.some((option) => option.name === selectedCategory)) {
				selectedCategory = "";
			}
			dailyFilterBar.innerHTML = "";
			options.forEach((option) => {
				const button = document.createElement("button");
				button.type = "button";
				button.dataset.dailyPaperFilter = option.name;
				button.classList.toggle("is-active", option.name === selectedCategory);
				button.textContent = `${option.label} ${option.count}`;
				dailyFilterBar.appendChild(button);
			});
		}

		function renderDateList() {
			if (!dateList) {
				return;
			}
			const counts = {};
			getRelevantDailyItems().forEach((paper) => {
				const date = getPaperDate(paper);
				if (date) {
					counts[date] = (counts[date] || 0) + 1;
				}
			});
			const dates = Object.keys(counts).sort((a, b) => b.localeCompare(a));
			const pagination = window.HomepageDatePagination.paginateDates(dates, datePageIndex, 5);
			datePageIndex = pagination.pageIndex;
			dateList.innerHTML = "";
			const totalCount = Object.keys(counts).reduce((sum, date) => sum + counts[date], 0);
			const allButton = document.createElement("button");
			allButton.type = "button";
			allButton.className = "paper-date-button";
			allButton.dataset.paperDateButton = "";
			allButton.classList.toggle("is-active", !selectedDate);
			const allDateLabel = document.createElement("span");
			allDateLabel.textContent = "All dates";
			const allCountLabel = document.createElement("span");
			allCountLabel.textContent = totalCount + " 篇";
			allButton.appendChild(allDateLabel);
			allButton.appendChild(allCountLabel);
			dateList.appendChild(allButton);
			pagination.items.forEach((date) => {
					const button = document.createElement("button");
					button.type = "button";
					button.className = "paper-date-button";
					button.dataset.paperDateButton = date;
					button.classList.toggle("is-active", selectedDate === date);
					const dateLabel = document.createElement("span");
					dateLabel.textContent = date;
					const countLabel = document.createElement("span");
					countLabel.textContent = counts[date] + " 篇";
					button.appendChild(dateLabel);
					button.appendChild(countLabel);
					dateList.appendChild(button);
				});
			if (pagination.showPagination) {
				const controls = document.createElement("div");
				controls.className = "paper-date-pagination";

				const previous = document.createElement("button");
				previous.type = "button";
				previous.className = "paper-date-page-button";
				previous.dataset.paperDatePage = "-1";
				previous.setAttribute("aria-label", "Show newer Daily Paper dates");
				previous.textContent = "←";
				previous.disabled = !pagination.canPrevious;

				const status = document.createElement("span");
				status.className = "paper-date-page-status";
				status.textContent = `${pagination.pageNumber} / ${pagination.totalPages}`;
				status.setAttribute("aria-live", "polite");

				const next = document.createElement("button");
				next.type = "button";
				next.className = "paper-date-page-button";
				next.dataset.paperDatePage = "1";
				next.setAttribute("aria-label", "Show older Daily Paper dates");
				next.textContent = "→";
				next.disabled = !pagination.canNext;

				controls.appendChild(previous);
				controls.appendChild(status);
				controls.appendChild(next);
				dateList.appendChild(controls);
			}
		}

		function renderRail(items) {
			if (!list) {
				return;
			}
			list.innerHTML = "";
			items.slice(0, 6).forEach((paper) => {
				const link = document.createElement("a");
				link.className = "daily-paper-card";
				link.href = paper.url || "#";
				link.target = "_blank";
				link.rel = "noopener noreferrer";

				const meta = document.createElement("span");
				meta.textContent = [paper.published, paper.primary_category].filter(Boolean).join(" / ");
				const title = document.createElement("strong");
				title.textContent = paper.title || "Untitled paper";
				const summary = document.createElement("p");
				summary.textContent = paper.summary || "";

				link.appendChild(meta);
				link.appendChild(title);
				link.appendChild(summary);
				list.appendChild(link);
			});
		}

		function createInfoRow(label, value, asParagraph) {
			const row = document.createElement("div");
			row.className = "paper-info-row";
			const labelNode = document.createElement("strong");
			labelNode.textContent = label;
			const valueNode = asParagraph ? document.createElement("p") : document.createElement("span");
			valueNode.textContent = value;
			row.appendChild(labelNode);
			row.appendChild(valueNode);
			return row;
		}

		function createLinksRow(paper) {
			const row = document.createElement("div");
			row.className = "paper-info-row";
			const labelNode = document.createElement("strong");
			labelNode.textContent = "链接";
			const links = document.createElement("div");
			links.className = "paper-link-row";
			const arxivUrl = (paper.url || "#").replace(/^http:\/\//, "https://");
			const repoUrl = getRepoUrl(paper);

			if (arxivUrl && arxivUrl !== "#") {
				const link = document.createElement("a");
				link.href = arxivUrl;
				link.target = "_blank";
				link.rel = "noopener noreferrer";
				link.textContent = "arXiv";
				links.appendChild(link);
			}
			if (repoUrl) {
				const repo = document.createElement("a");
				repo.href = repoUrl;
				repo.target = "_blank";
				repo.rel = "noopener noreferrer";
				repo.textContent = "开源仓库";
				links.appendChild(repo);
			} else {
				const missing = document.createElement("span");
				missing.textContent = "未发现开源仓库";
				links.appendChild(missing);
			}
			row.appendChild(labelNode);
			row.appendChild(links);
			return row;
		}

		function createQuickFact(label, value) {
			const item = document.createElement("div");
			item.className = "paper-quickfact";
			const labelNode = document.createElement("strong");
			labelNode.textContent = label;
			item.appendChild(labelNode);
			if (value && value.nodeType) {
				item.appendChild(value);
			} else {
				const text = document.createElement("span");
				text.textContent = value || "待确认";
				item.appendChild(text);
			}
			return item;
		}

		function createPaperLinks(paper) {
			const links = document.createElement("div");
			links.className = "paper-link-row";
			const arxivUrl = (paper.url || "").replace(/^http:\/\//, "https://");
			const repoUrl = getRepoUrl(paper);
			if (arxivUrl) {
				const link = document.createElement("a");
				link.href = arxivUrl;
				link.target = "_blank";
				link.rel = "noopener noreferrer";
				link.textContent = "arXiv";
				links.appendChild(link);
			}
			if (repoUrl) {
				const repo = document.createElement("a");
				repo.href = repoUrl;
				repo.target = "_blank";
				repo.rel = "noopener noreferrer";
				repo.textContent = "开源仓库";
				links.appendChild(repo);
			}
			if (!links.children.length) {
				const missing = document.createElement("span");
				missing.textContent = "暂无链接";
				links.appendChild(missing);
			}
			return links;
		}

		function createPaperFactLine(label, value) {
			const row = document.createElement("div");
			row.className = "paper-fact-line";
			const labelNode = document.createElement("strong");
			labelNode.textContent = label;
			row.appendChild(labelNode);
			if (value && value.nodeType) {
				row.appendChild(value);
			} else {
				const text = document.createElement("span");
				text.textContent = value || "待确认";
				row.appendChild(text);
			}
			return row;
		}

		function createPaperFactsStrip(paper) {
			const facts = document.createElement("div");
			facts.className = "paper-facts-strip";
			const repoUrl = getRepoUrl(paper);
			facts.appendChild(createPaperFactLine("单位", getAffiliations(paper)));
			facts.appendChild(createPaperFactLine("开源仓库", repoUrl || "未发现公开仓库"));
			facts.appendChild(createPaperFactLine("贡献", getContribution(paper)));
			facts.appendChild(createPaperFactLine("链接", createPaperLinks(paper)));
			return facts;
		}

		function createQuickFacts(paper) {
			const facts = document.createElement("div");
			facts.className = "paper-quickfacts";
			const repoUrl = getRepoUrl(paper);
			facts.appendChild(createQuickFact("单位", getAffiliations(paper)));
			facts.appendChild(createQuickFact("开源仓库", repoUrl || "未发现公开仓库"));
			facts.appendChild(createQuickFact("贡献", getContribution(paper)));
			facts.appendChild(createQuickFact("链接", createPaperLinks(paper)));
			return facts;
		}

		function createInterpretationGrid(paper) {
			const grid = document.createElement("div");
			grid.className = "paper-interpretation-grid";
			const interpretation = getPaperInterpretation(paper);
			Object.keys(interpretation).forEach((label) => {
				const item = document.createElement("section");
				item.className = "paper-interpretation-item";
				const heading = document.createElement("strong");
				heading.textContent = label;
				const body = document.createElement("p");
				body.textContent = interpretation[label];
				item.appendChild(heading);
				item.appendChild(body);
				grid.appendChild(item);
			});
			return grid;
		}

		function createDetailSection(label, value) {
			if (!value) {
				return null;
			}
			const section = document.createElement("section");
			section.className = "paper-detail-section";
			const heading = document.createElement("h4");
			heading.textContent = label;
			const body = document.createElement("p");
			body.textContent = value;
			section.appendChild(heading);
			section.appendChild(body);
			return section;
		}

		function createPaperDetailPanel(paper) {
			const details = document.createElement("details");
			details.className = "paper-detail-panel";
			const summary = document.createElement("summary");
			summary.textContent = "详情";
			details.appendChild(summary);

			const content = document.createElement("div");
			content.className = "paper-detail-content";
			const interpretation = getPaperInterpretation(paper);
			Object.keys(interpretation).forEach((label) => {
				const section = createDetailSection(label, interpretation[label]);
				if (section) {
					content.appendChild(section);
				}
			});
			const recommendation = getRecommendation(paper);
			[
				createDetailSection("贡献", getContribution(paper)),
				createDetailSection("推荐理由", [recommendation.judgement, recommendation.reason].filter(Boolean).join(" ")),
				createDetailSection("局限", paper.analysis && paper.analysis.limitations),
			].filter(Boolean).forEach((section) => content.appendChild(section));

			details.appendChild(content);
			return details;
		}

		function createRecommendationPanel(paper) {
			const recommendation = getRecommendation(paper);
			const panel = document.createElement("div");
			panel.className = "paper-recommendation";

			const score = document.createElement("div");
			score.className = "recommendation-score";
			const scoreValue = document.createElement("strong");
			scoreValue.textContent = recommendation.level || "中";
			const scoreLabel = document.createElement("span");
			scoreLabel.textContent = "相关度";
			score.appendChild(scoreValue);
			score.appendChild(scoreLabel);

			const judgement = document.createElement("div");
			judgement.className = "recommendation-judgement";
			const labels = document.createElement("div");
			labels.className = "recommendation-labels";
			const label = document.createElement("span");
			label.className = "recommendation-pill";
			label.textContent = recommendation.label;
			const risk = document.createElement("span");
			const riskClass = recommendation.waterRisk === "低"
				? "low"
				: recommendation.waterRisk === "中"
					? "medium"
					: recommendation.waterRisk === "高"
						? "high"
						: "unknown";
			risk.className = `recommendation-pill risk-${riskClass}`;
			risk.textContent = `偏水风险：${recommendation.waterRisk}`;
			labels.appendChild(label);
			labels.appendChild(risk);
			const body = document.createElement("p");
			body.textContent = [recommendation.judgement, recommendation.reason].filter(Boolean).join(" ");
			judgement.appendChild(labels);
			judgement.appendChild(body);

			panel.appendChild(score);
			panel.appendChild(judgement);
			return panel;
		}

		function getPaperById(id) {
			return allItems.find((paper) => getPaperKey(paper) === id);
		}

		function buildDigestText(data) {
			const date = data.digest && data.digest.report_date
				? data.digest.report_date
				: new Date(data.updated_at || Date.now()).toISOString().slice(0, 10);
			const relevantItems = getRelevantDailyItems();
			const top = relevantItems
				.slice()
				.sort((a, b) => getRecommendation(b).score - getRecommendation(a).score)
				.slice(0, 3);
			return [
				`${date} Daily Paper`,
				"",
				`今日保留 ${relevantItems.length} 篇候选，重点关注 long horizon、multi-turn、agentic rl 和 agent planning。`,
				"",
				"最值得读的 3 篇",
				...top.map((paper, index) => {
					const recommendation = getRecommendation(paper);
					const brief = paper.brief || {};
					return [
						`${index + 1}. ${paper.title}`,
						`- 作者：${Array.isArray(paper.authors) ? paper.authors.join(", ") : "N/A"}`,
						`- 单位：${getAffiliations(paper)}`,
						`- 日期：${getPaperDate(paper) || "N/A"}`,
						`- 论文链接：${(paper.url || "").replace(/^http:\/\//, "https://")}`,
						`- 项目页：${paper.project_url || brief.project_url || "未发现"}`,
						`- 代码仓库：${getRepoUrl(paper) || "未发现"}`,
						`- 录用：${paper.venue_status || brief.venue_status || "未确认录用"}`,
						`- 相关度：${recommendation.level}（原因：${recommendation.reason || recommendation.label}；偏水风险：${recommendation.waterRisk}）`,
						`- 贡献：${getContribution(paper)}`,
						`- 总结：${brief.summary || paper.summary || "待自动化补充"}`,
						`- 亮点：${Array.isArray(brief.highlights) ? brief.highlights.join("；") : recommendation.judgement}`,
					].join("\n");
				}),
			].join("\n");
		}

		function createDigestList(title, papers, fallback) {
			const section = document.createElement("section");
			section.className = "digest-list";
			const heading = document.createElement("strong");
			heading.textContent = title;
			section.appendChild(heading);
			if (!papers.length) {
				const emptyText = document.createElement("p");
				emptyText.textContent = fallback;
				section.appendChild(emptyText);
				return section;
			}
			const listNode = document.createElement("ol");
			papers.forEach((paper) => {
				const item = document.createElement("li");
				const recommendation = getRecommendation(paper);
				const link = document.createElement("a");
				link.href = (paper.url || "#").replace(/^http:\/\//, "https://");
				link.target = "_blank";
				link.rel = "noopener noreferrer";
				link.textContent = paper.title || "Untitled paper";
				const meta = document.createElement("span");
				meta.textContent = `相关度 ${recommendation.level} · 偏水风险 ${recommendation.waterRisk}`;
				item.appendChild(link);
				item.appendChild(meta);
				listNode.appendChild(item);
			});
			section.appendChild(listNode);
			return section;
		}

		function renderDigest(data) {
			if (!digestBox) {
				return;
			}
			const digest = data.digest || {};
			const topIds = Array.isArray(digest.top_recommendations) ? digest.top_recommendations : [];
			const lowIds = Array.isArray(digest.low_priority) ? digest.low_priority : [];
			const relevantItems = getRelevantDailyItems();
			const topPapers = topIds.length
				? topIds.map(getPaperById).filter((paper) => paper && isDailyPaperRelevant(paper) && !isDailyDeleted(paper))
				: relevantItems.slice().sort((a, b) => getRecommendation(b).score - getRecommendation(a).score).slice(0, 3);
			const lowPapers = lowIds.length
				? lowIds.map(getPaperById).filter((paper) => paper && isDailyPaperRelevant(paper) && !isDailyDeleted(paper))
				: relevantItems.filter((paper) => getRecommendation(paper).waterRisk !== "低").slice(0, 3);

			digestBox.innerHTML = "";
			digestBox.hidden = false;

			const heading = document.createElement("div");
			heading.className = "digest-heading";
			const title = document.createElement("h4");
			title.textContent = digest.title || "Daily Paper 自动化摘要";
			const summary = document.createElement("p");
			summary.textContent = `当前只显示 long horizon、multi-turn、agentic rl 和 agent planning 相关论文，共 ${relevantItems.length} 篇。`;
			heading.appendChild(title);
			heading.appendChild(summary);
			digestBox.appendChild(heading);

			const meta = document.createElement("div");
			meta.className = "digest-meta-row";
			["long horizon", "multi-turn", "agentic rl", "agent planning"].forEach((value) => {
				const span = document.createElement("span");
				span.textContent = value;
				meta.appendChild(span);
			});
			if (meta.children.length) {
				digestBox.appendChild(meta);
			}

			const columns = document.createElement("div");
			columns.className = "digest-columns";
			columns.appendChild(createDigestList("最值得读的 3 篇", topPapers, "今天没有高相关新增论文。"));
			columns.appendChild(createDigestList("暂不优先 / 可能偏水", lowPapers, "没有明显偏水候选。"));
			digestBox.appendChild(columns);
		}

		function renderDailyDerivedViews() {
			if (!currentDailyData) {
				return;
			}
			const relevantItems = getRelevantDailyItems();
			currentDigestText = buildDigestText(currentDailyData);
			setEmpty(
				empty,
				"没有符合 long horizon / multi-turn / agentic rl / agent planning 的 Daily Paper。",
				Boolean(relevantItems.length)
			);
			renderDigest(currentDailyData);
			renderRail(relevantItems);
		}

		function renderDailyState() {
			renderFull();
			renderDailyDerivedViews();
		}

		function copyText(text) {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				return navigator.clipboard.writeText(text);
			}
			return new Promise((resolve, reject) => {
				const textarea = document.createElement("textarea");
				textarea.value = text;
				textarea.setAttribute("readonly", "");
				textarea.style.position = "fixed";
				textarea.style.left = "-9999px";
				document.body.appendChild(textarea);
				textarea.select();
				try {
					document.execCommand("copy");
					document.body.removeChild(textarea);
					resolve();
				} catch (error) {
					document.body.removeChild(textarea);
					reject(error);
				}
			});
		}

		function renderFull() {
			if (!fullList) {
				return;
			}
			const items = getFilteredItems();
			currentModalItems = items;
			fullList.innerHTML = "";
			renderDailyFilters();
			setEmpty(
				fullEmpty,
				"当前日期没有 Daily Paper。",
				Boolean(items.length)
			);
			items.forEach((paper, index) => {
				const key = getPaperKey(paper);
				const card = document.createElement("article");
				card.className = "academic-paper-card";
				card.dataset.paperKey = key;

				const meta = document.createElement("div");
				meta.className = "academic-paper-meta";
				const authors = Array.isArray(paper.authors) ? paper.authors.slice(0, 2).join(", ") : "";
				[getPaperDate(paper), paper.primary_category, authors].filter(Boolean).forEach((value) => {
					const span = document.createElement("span");
					span.textContent = value;
					meta.appendChild(span);
				});

				const top = document.createElement("div");
				top.className = "paper-card-top";
				top.appendChild(meta);
				const titleWrap = document.createElement("div");
				titleWrap.className = "paper-card-title";
				const title = document.createElement("h3");
				title.textContent = paper.title || "Untitled paper";
				titleWrap.appendChild(title);

				const actions = document.createElement("div");
				actions.className = "paper-card-actions";
				const starButton = document.createElement("button");
				starButton.type = "button";
				starButton.className = "paper-star-button";
				starButton.classList.toggle("is-starred", isDailyStarred(paper));
				starButton.setAttribute("aria-pressed", isDailyStarred(paper) ? "true" : "false");
				starButton.setAttribute("aria-label", isDailyStarred(paper) ? "Unstar daily paper" : "Star daily paper");
				starButton.textContent = isDailyStarred(paper) ? "★" : "☆";
				starButton.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					toggleDailyStar(paper);
					renderFull();
				});
				const detailButton = document.createElement("button");
				detailButton.type = "button";
				detailButton.className = "paper-detail-trigger";
				detailButton.textContent = "详情";
				detailButton.addEventListener("click", () => {
					openPaperModal(paper, index, items.length);
				});
				actions.appendChild(starButton);
				actions.appendChild(detailButton);
				if (isOwnerModeEnabled()) {
					const deleted = isDailyDeleted(paper);
					const deleteButton = document.createElement("button");
					deleteButton.type = "button";
					deleteButton.className = deleted ? "paper-restore-button" : "paper-delete-button";
					deleteButton.textContent = deleted ? "Restore" : "Delete";
					deleteButton.setAttribute("aria-label", deleted ? "Restore daily paper" : "Delete daily paper");
					deleteButton.addEventListener("click", (event) => {
						event.preventDefault();
						event.stopPropagation();
						setDailyDeleted(paper, !deleted);
						renderDailyState();
					});
					actions.appendChild(deleteButton);
				}
				top.appendChild(titleWrap);
				top.appendChild(actions);

				const summary = document.createElement("p");
				summary.className = "paper-card-summary";
				summary.textContent = getPaperCardSummary(paper);

				const tags = document.createElement("div");
				tags.className = "academic-paper-tags";
				getPaperTags(paper).forEach((tag) => {
					const span = document.createElement("span");
					span.textContent = tag;
					tags.appendChild(span);
				});

				card.appendChild(top);
				card.appendChild(summary);
				card.appendChild(tags);
				fullList.appendChild(card);
			});
			renderDateList();
			setSortButtonState();
		}

		function renderEmptyState(message) {
			if (list) {
				list.innerHTML = "";
			}
			if (fullList) {
				fullList.innerHTML = "";
			}
			setEmpty(empty, message, false);
			setEmpty(fullEmpty, message, false);
		}

		function findPaperByKey(key) {
			return allItems.find((paper) => getPaperKey(paper) === key);
		}

		if (digestCopy) {
			digestCopy.addEventListener("click", () => {
				if (!currentDigestText) {
					if (digestStatus) {
						digestStatus.textContent = "暂无可复制的邮件摘要";
					}
					return;
				}
				copyText(currentDigestText)
					.then(() => {
						if (digestStatus) {
							digestStatus.textContent = "已复制";
						}
					})
					.catch(() => {
						if (digestStatus) {
							digestStatus.textContent = "浏览器未允许复制，可打开 data JSON 查看 email_body";
						}
					});
			});
		}

		if (dateInput) {
			dateInput.addEventListener("change", () => {
				selectedDate = dateInput.value;
				selectedCategory = "";
				renderFull();
			});
		}

		if (dateClear) {
			dateClear.addEventListener("click", () => {
				selectedDate = "";
				selectedCategory = "";
				if (dateInput) {
					dateInput.value = "";
				}
				renderFull();
			});
		}

		if (dateList) {
			dateList.addEventListener("click", (event) => {
				const pageButton = event.target.closest("[data-paper-date-page]");
				if (pageButton && !pageButton.disabled) {
					datePageIndex += Number(pageButton.dataset.paperDatePage) || 0;
					renderDateList();
					return;
				}
				const button = event.target.closest("[data-paper-date-button]");
				if (!button) {
					return;
				}
				selectedDate = button.dataset.paperDateButton;
				selectedCategory = "";
				if (dateInput) {
					dateInput.value = selectedDate;
				}
				renderFull();
			});
		}

		sortButtons.forEach((button) => {
			button.addEventListener("click", () => {
				sortOrder = button.dataset.paperSort === "asc" ? "asc" : "desc";
				window.localStorage.setItem(SORT_STORAGE_KEY, sortOrder);
				renderFull();
			});
		});

		if (dailyFilterBar) {
			dailyFilterBar.addEventListener("click", (event) => {
				const button = event.target.closest("[data-daily-paper-filter]");
				if (!button) {
					return;
				}
				const value = button.dataset.dailyPaperFilter || "";
				selectedCategory = value === selectedCategory ? "" : value;
				renderFull();
			});
		}

		if (window.JunleRealtime) {
			window.JunleRealtime.on("reactions:daily_paper", (keys) => {
				applyDailyReactionKeys(keys || []);
			});
			window.JunleRealtime.loadReactions("daily_paper").then((keys) => {
				applyDailyReactionKeys(keys || []);
			});
		}
		window.addEventListener("junle-owner-mode-change", renderDailyState);
		window.addEventListener("storage", (event) => {
			if (event.key === DAILY_DELETE_STORAGE_KEY || event.key === OWNER_STORAGE_KEY) {
				deletedDailyKeys = loadDailyDeletedKeys();
				renderDailyState();
			}
		});

		window.openAcademicPaperModal = openPaperModal;

		modalCloseButtons.forEach((button) => {
			button.addEventListener("click", closePaperModal);
		});
		if (modalPrev) {
			modalPrev.addEventListener("click", () => openModalByOffset(-1));
		}
		if (modalNext) {
			modalNext.addEventListener("click", () => openModalByOffset(1));
		}
		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && modal && !modal.hidden) {
				closePaperModal();
			}
			if (event.key === "ArrowLeft" && modal && !modal.hidden) {
				openModalByOffset(-1);
			}
			if (event.key === "ArrowRight" && modal && !modal.hidden) {
				openModalByOffset(1);
			}
		});

		fetch("assets/content/data/daily-papers.json", { cache: "no-store" })
			.then((response) => {
				if (!response.ok) {
					throw new Error("Daily paper data missing");
				}
				return response.json();
			})
			.then((data) => {
				const items = data.items || [];
				currentDailyData = data;
				allItems = items.slice();
				const relevantItems = getRelevantDailyItems();
				currentDigestText = buildDigestText(data);
				setUpdatedLabel(data);
				if (!relevantItems.length) {
					setEmpty(
						empty,
						"没有符合 long horizon / multi-turn / agentic rl / agent planning 的 Daily Paper。",
						false
					);
				} else {
					setEmpty(empty, "", true);
				}
				setEmpty(fullEmpty, "", true);
				renderDigest(data);
				renderRail(relevantItems);
				renderFull();
			})
			.catch(() => {
				renderEmptyState("Daily paper data is not available yet.");
			});
	}

	function bindZoteroPaperList() {
		const list = document.querySelector("[data-zotero-paper-list]");
		const summaryNode = document.querySelector("[data-paper-list-summary]");
		const filterBar = document.querySelector("[data-zotero-filter-bar]");
		const empty = document.querySelector("[data-zotero-paper-empty]");
		if (!list) {
			return;
		}

		let allItems = [];
		let groups = [];
		let selectedCollection = "";
		const STAR_STORAGE_KEY = "junle-homepage-zotero-paper-stars";
		let starredKeys = loadStarredKeys();
		let remoteStarredKeys = [];

		function compact(text, maxLength) {
			const value = String(text || "").replace(/\s+/g, " ").trim();
			if (value.length <= maxLength) {
				return value;
			}
			return value.slice(0, maxLength - 1).trim() + "...";
		}

		function loadStarredKeys() {
			try {
				const value = JSON.parse(window.localStorage.getItem(STAR_STORAGE_KEY) || "[]");
				return Array.isArray(value) ? value : [];
			} catch (error) {
				return [];
			}
		}

		function saveStarredKeys() {
			try {
				window.localStorage.setItem(STAR_STORAGE_KEY, JSON.stringify(starredKeys));
			} catch (error) {
				// Local star state is a convenience feature; rendering should not depend on storage.
			}
		}

		function getZoteroKey(paper) {
			return paper.zotero_key || paper.url || paper.title || "zotero-paper";
		}

		function getStarredKeys() {
			return uniqueList(starredKeys.concat(remoteStarredKeys));
		}

		function isStarred(paper) {
			return getStarredKeys().indexOf(getZoteroKey(paper)) !== -1;
		}

		function toggleStar(paper) {
			const key = getZoteroKey(paper);
			const nextStarred = !isStarred(paper);
			if (
				window.JunleRealtime &&
				window.JunleRealtime.isEnabled &&
				window.JunleRealtime.isEnabled() &&
				window.JunleRealtime.canWrite &&
				window.JunleRealtime.canWrite()
			) {
				window.JunleRealtime.setReaction("zotero_paper", key, nextStarred)
					.catch(() => {
						renderItems();
					});
				return;
			}
			if (nextStarred) {
				starredKeys = starredKeys.concat(key);
			} else {
				starredKeys = starredKeys.filter((value) => value !== key);
			}
			saveStarredKeys();
		}

		function setEmpty(message, hidden) {
			if (empty) {
				empty.hidden = hidden;
				empty.textContent = message;
			}
		}

		function renderSummary(filteredItems) {
			if (!summaryNode) {
				return;
			}
			summaryNode.innerHTML = "";
			summaryNode.hidden = true;
		}

		function getZoteroCollections(paper) {
			return []
				.concat(paper.collections || [])
				.concat(paper.collection_shorts || [])
				.filter(Boolean);
		}

		function paperInCollection(paper, collectionName) {
			if (!collectionName) {
				return true;
			}
			if (collectionName === "__starred") {
				return isStarred(paper);
			}
			return getZoteroCollections(paper).indexOf(collectionName) !== -1;
		}

		function getVisibleItems() {
			return allItems.filter((paper) => paperInCollection(paper, selectedCollection));
		}

		function renderFilters() {
			if (!filterBar) {
				return;
			}
			filterBar.innerHTML = "";
			const options = [
				{ name: "", label: "All", count: allItems.length },
				{ name: "__starred", label: "Star", count: allItems.filter(isStarred).length },
				...groups
					.filter((group) => group.count)
					.map((group) => ({
						name: group.name,
						label: group.short || group.name,
						count: group.count,
					})),
			];
			options.forEach((option) => {
				const button = document.createElement("button");
				button.type = "button";
				button.dataset.zoteroFilter = option.name;
				button.classList.toggle("is-active", selectedCollection === option.name);
				button.textContent = `${option.label} ${option.count}`;
				filterBar.appendChild(button);
			});
		}

		function appendMeta(parent, values) {
			const meta = document.createElement("div");
			meta.className = "academic-paper-meta";
			values.filter(Boolean).forEach((value) => {
				const span = document.createElement("span");
				span.textContent = value;
				meta.appendChild(span);
			});
			parent.appendChild(meta);
		}

		function firstSentence(text, pattern) {
			const sentences = String(text || "")
				.replace(/\s+/g, " ")
				.split(/(?<=[.!?。！？])\s+/)
				.filter(Boolean);
			return sentences.find((sentence) => pattern.test(sentence)) || "";
		}

		function zoteroAnalysisFor(paper) {
			if (paper.analysis) {
				return {
					"论文动机": paper.analysis.motivation || "需读正文确认动机。",
					"方法": paper.analysis.method || "需读正文确认方法。",
					"实验结果": paper.analysis.experiments || "需读正文确认实验结果。",
					"Insight": paper.analysis.insight || paper.analysis.research_help || paper.summary || "作为 Zotero Planning 候选，先检查任务设定和评测协议。",
				};
			}
			const title = paper.title || "";
			const abstract = paper.abstract || "";
			const source = `${title} ${abstract} ${paper.reason || ""} ${(paper.collections || []).join(" ")}`.toLowerCase();
			const motivation = /benchmark|evaluation|metric|dataset/.test(source)
				? "动机是补足 agent planning / agent memory 的评测缺口，帮助定位模型在哪类多步任务中失败。"
				: /constraint|solver|verification|backtracking/.test(source)
					? "动机是让 LLM agent 的规划结果更可验证，减少约束违反、死循环或不可执行计划。"
					: /multi[- ]?turn|interactive|dialog/.test(source)
						? "动机是处理多轮交互里的状态延续、澄清和用户偏好变化。"
						: "动机是提升 LLM agent 在复杂任务中的规划、执行或可靠性表现。";
			const method = firstSentence(
				abstract,
				/\b(propose|introduce|present|framework|benchmark|dataset|method|model|agent|planner|evaluation)\b/i
			) || paper.summary || "方法需要结合正文确认；当前 Zotero 元数据只支持粗粒度判断。";
			const experiments = firstSentence(
				abstract,
				/\b(experiment|evaluate|benchmark|result|outperform|success|baseline|ablation|study)\b/i
			) || "摘要或 Zotero 元数据未提供明确实验结果；需要打开论文正文检查 benchmark、baseline 和 ablation。";
			const help = /benchmark|evaluation|dataset/.test(source)
				? "可作为评测基线或任务设计参考，适合对齐你的 agent planning benchmark。"
				: /long[- ]?horizon|planning|planner/.test(source)
					? "适合补充 long-horizon planning 的任务分解、失败恢复和约束检查思路。"
					: /memory|stateful|preference|personal/.test(source)
						? "适合补充 agent memory、个性化状态和偏好延续相关实验。"
						: "适合放在 Planning 文献池里做候选，优先看问题设定是否能服务当前 research。";
			return {
				"论文动机": motivation,
				"方法": method,
				"实验结果": experiments,
				"Insight": help,
			};
		}

		function getZoteroTags(paper) {
			const tags = (paper.collection_shorts && paper.collection_shorts.length)
				? paper.collection_shorts
				: getZoteroCollections(paper);
			return tags.slice(0, 6);
		}

		function getZoteroCardSummary(paper) {
			const brief = paper.brief || {};
			const analysisFields = paper.analysis || {};
			const analysis = zoteroAnalysisFor(paper);
			return compact(
				analysisFields.card_summary ||
					brief.card_summary ||
					paper.summary ||
					analysis["Insight"] ||
					paper.reason ||
					paper.abstract ||
					"这篇 Zotero paper 还没有摘要。",
				210
			);
		}

		function normalizeZoteroForModal(paper) {
			const brief = paper.brief || {};
			const analysisFields = paper.analysis || {};
			const analysis = zoteroAnalysisFor(paper);
			return {
				id: `zotero-${getZoteroKey(paper)}`,
				title: paper.title || "Untitled paper",
				summary: paper.abstract || paper.summary || paper.reason || "",
				url: paper.arxiv_url || paper.paper_url || paper.url || "",
				arxiv_url: paper.arxiv_url || "",
				paper_url: paper.paper_url || "",
				pdf_url: paper.pdf_url || "",
				repo_url: paper.repo_url || "",
				authors: paper.authors || [],
				published: paper.year || "",
				updated: paper.year || "",
				primary_category: paper.publication || (paper.collection_shorts || [])[0] || "",
				categories: paper.collections || paper.collection_shorts || [],
				affiliations: paper.affiliations || "",
				recommendation: paper.recommendation,
				brief: {
					...brief,
					card_summary: getZoteroCardSummary(paper),
					full_summary: brief.full_summary || analysisFields.full_summary || "",
					abstract_zh: brief.abstract_zh || analysisFields.abstract_zh || "",
					contribution: brief.contribution || paper.reason || "",
					highlights: brief.highlights || [],
					limitations: brief.limitations || analysisFields.limitations || "",
					repo_url: paper.repo_url || "",
				},
				analysis: {
					...analysisFields,
					motivation: analysis["论文动机"],
					method: analysis["方法"],
					experiments: analysis["实验结果"],
					insight: analysisFields.insight || analysis["Insight"],
					research_help: analysisFields.research_help || analysis["Insight"],
				},
			};
		}

		function renderItems() {
			const visibleItems = getVisibleItems();
			const items = visibleItems.slice().sort((a, b) => {
					const starCompare = Number(isStarred(b)) - Number(isStarred(a));
					if (starCompare !== 0) {
						return starCompare;
					}
					const yearCompare = String(b.year || "").localeCompare(String(a.year || ""));
					if (yearCompare !== 0) {
						return yearCompare;
					}
					return String(a.title || "").localeCompare(String(b.title || ""));
				});
			const modalItems = items.map(normalizeZoteroForModal);
			list.innerHTML = "";
			renderFilters();
			renderSummary(visibleItems);
			if (!allItems.length) {
				setEmpty("Zotero Paper List is not available yet.", false);
				return;
			}
			if (!items.length) {
				setEmpty("当前分类没有 paper。", false);
				return;
			}
			setEmpty("", true);
			items.forEach((paper, index) => {
					const card = document.createElement("article");
					card.className = "academic-paper-card zotero-paper-card";
					card.dataset.paperKey = getZoteroKey(paper);

					const top = document.createElement("div");
					top.className = "paper-card-top";
					const titleWrap = document.createElement("div");
					titleWrap.className = "paper-card-title";
					appendMeta(top, [
						paper.year || "年份待确认",
						paper.publication || "",
						(paper.collections || []).slice(0, 2).join(" / "),
					]);

					const title = document.createElement("h3");
					title.textContent = paper.title || "Untitled paper";
					titleWrap.appendChild(title);

					const actions = document.createElement("div");
					actions.className = "paper-card-actions";
					const starButton = document.createElement("button");
					starButton.type = "button";
					starButton.className = "paper-star-button";
					starButton.classList.toggle("is-starred", isStarred(paper));
					starButton.setAttribute("aria-pressed", isStarred(paper) ? "true" : "false");
					starButton.setAttribute("aria-label", isStarred(paper) ? "Unstar paper" : "Star paper");
					starButton.textContent = isStarred(paper) ? "★" : "☆";
					starButton.addEventListener("click", (event) => {
						event.preventDefault();
						event.stopPropagation();
						toggleStar(paper);
						renderItems();
					});
					const detailButton = document.createElement("button");
					detailButton.type = "button";
					detailButton.className = "paper-detail-trigger";
					detailButton.textContent = "详情";
					detailButton.addEventListener("click", () => {
						if (window.openAcademicPaperModal) {
							window.openAcademicPaperModal(modalItems[index], index, modalItems.length, modalItems);
						} else if (paper.url) {
							window.open(paper.url, "_blank", "noopener,noreferrer");
						}
					});
					actions.appendChild(starButton);
					const sourceUrl = paper.arxiv_url || paper.paper_url || paper.url || "";
					if (sourceUrl) {
						const sourceLink = document.createElement("a");
						sourceLink.href = sourceUrl;
						sourceLink.target = "_blank";
						sourceLink.rel = "noopener noreferrer";
						sourceLink.textContent = /arxiv\.org/i.test(sourceUrl) ? "arXiv" : "Paper";
						actions.appendChild(sourceLink);
					}
					actions.appendChild(detailButton);
					top.appendChild(titleWrap);
					top.appendChild(actions);

					const summary = document.createElement("p");
					summary.className = "paper-card-summary";
					summary.textContent = getZoteroCardSummary(paper);

					const tags = document.createElement("div");
					tags.className = "academic-paper-tags";
					getZoteroTags(paper).forEach((tag) => {
						const span = document.createElement("span");
						span.textContent = tag;
						tags.appendChild(span);
					});

					card.appendChild(top);
					card.appendChild(summary);
					card.appendChild(tags);
					list.appendChild(card);
				});
		}

			if (filterBar) {
				filterBar.addEventListener("click", (event) => {
					const button = event.target.closest("[data-zotero-filter]");
					if (!button) {
						return;
				}
				selectedCollection = button.dataset.zoteroFilter || "";
				renderItems();
				});
			}

			if (window.JunleRealtime) {
				window.JunleRealtime.on("reactions:zotero_paper", (keys) => {
					remoteStarredKeys = keys || [];
					renderItems();
				});
				window.JunleRealtime.loadReactions("zotero_paper").then((keys) => {
					remoteStarredKeys = keys || [];
					renderItems();
				});
			}

			fetch("assets/content/data/zotero-paper-list.json", { cache: "no-store" })
			.then((response) => {
				if (!response.ok) {
					throw new Error("Zotero paper list data missing");
				}
				return response.json();
			})
			.then((data) => {
				allItems = Array.isArray(data.items) ? data.items : [];
				groups = Array.isArray(data.groups) ? data.groups : [];
				renderItems();
			})
			.catch(() => {
				list.innerHTML = "";
				if (summaryNode) {
					summaryNode.innerHTML = "";
				}
				if (filterBar) {
					filterBar.innerHTML = "";
				}
				setEmpty("Zotero Paper List is not available yet.", false);
			});
	}

	window.addEventListener("DOMContentLoaded", () => {
			bindContentFilters();
			bindLocalAnchors();
			bindHashNavigation();
			bindThemeToggle();
			bindGlassTopbar();
			bindNoteViewToggle();
			bindExternalDropdown();
			bindRealtimeAuthControls();
			bindNoteReader();
			bindMemoManager();
		bindDailyPapers();
		bindZoteroPaperList();
		revealInitialHash();
	});
