import React from "react";
import logo from "./logo.svg";
import "./App.scss";

import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";

import { Container, Stack } from "@mui/material";
import { BrowserRouter } from "react-router-dom";

import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import AppContainer from "./modules/AppContainer.layout";

function App() {
    console.debug("App loaded");
    console.debug(process.env.PUBLIC_URL);
    return (
        <div className="App" style={{ width: "100vw" }}>
            <React.StrictMode>
                <BrowserRouter basename={`/${process.env.PUBLIC_URL}`}>
                    <Stack style={{ width: "100vw" }}>
                        <Box sx={{ flexGrow: 1 }}>
                            <AppBar position="static" style={{ backgroundColor: "#ff9800" }}>
                                <Toolbar>
                                    <IconButton
                                        size="large"
                                        edge="start"
                                        color="inherit"
                                        aria-label="menu"
                                        sx={{ mr: 2 }}
                                    ></IconButton>
                                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                                        Pyramid Scheme
                                    </Typography>
                                    {/* <Button color="inherit">Login</Button> */}
                                </Toolbar>
                            </AppBar>
                        </Box>
                        <Stack display="flex" justifyContent="center">
                            <AppContainer />
                        </Stack>
                    </Stack>
                </BrowserRouter>
            </React.StrictMode>
        </div>
    );
}

export default App;
