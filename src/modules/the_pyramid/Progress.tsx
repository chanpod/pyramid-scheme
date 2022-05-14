import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import React from "react";

interface Props {
    timeLeft: number;
    duration: number;
    text: string;
}

const Progress = (props: Props) => {
    const value = (props.timeLeft / props.duration) * 100;

    return (
        <Box position="relative" display="inline-flex">
            <Stack>
                <Typography variant="h5">Next Cycle</Typography>
                <CircularProgress size={90} variant="determinate" value={value} />
                <Box
                    top={28}
                    left={-15}
                    bottom={0}
                    right={0}
                    position="absolute"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                >
                    <Typography
                        variant="h6"
                        component="div"
                        color="textSecondary"
                    >{`${props.timeLeft} s`}</Typography>
                </Box>
            </Stack>
        </Box>
    );
};

export default Progress;
