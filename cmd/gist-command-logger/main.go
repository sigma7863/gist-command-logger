package main

import (
	"os"

	"github.com/sigma7863/gist-command-logger/internal/app"
)

func main() {
	os.Exit(app.Run(os.Args[1:]))
}
