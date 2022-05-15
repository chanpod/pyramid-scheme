import React from "react";
import { Route, Routes } from "react-router-dom";
import ThePyramid from "./the_pyramid/ThePyramid";

export const AppContainer = () => {
    console.debug("App Container loaded")
    return (
        <div style={{ width: "100%" }}>
            <Routes>
                <Route path="/" element={<ThePyramid />} />
            </Routes>
        </div>
    );
};

export default AppContainer;
